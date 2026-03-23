// server.js — Полный сервер: чат, Redis, MySQL, Socket.IO

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'ваш_секретный_ключ_длиной_32_символа_или_больше_меняй_в_продакшене';

// CORS
app.use((req, res, next) => {
    const allowedOrigin = 'https://service-taxi31.ru';
    const origin = req.headers.origin;

    if (origin === allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

// Раздаём статику
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "https://service-taxi31.ru", credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 20000
});

// 🔌 Подключение к MySQL
let dbPool;
(async () => {
    try {
        dbPool = mysql.createPool({
            host: process.env.DB_HOST || 'host1874179.hostland.pro',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'host1874179_mess',
            password: process.env.DB_PASS || '111111',
            database: process.env.DB_NAME || 'host1874179_mess',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true
        });
        await dbPool.getConnection();
        console.log('✅ Подключились к MySQL');
    } catch (err) {
        console.error('❌ Ошибка MySQL:', err.message);
    }
})();

// 🟩 Подключение к Redis
let redisClient;
(async () => {
    redisClient = redis.createClient({ url: 'redis://localhost:6379' });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
    console.log('✅ Подключились к Redis');
})();

// Онлайн пользователи
const connectedUsers = new Set();
const userSockets = new Map();

// Аутентификация через JWT
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Требуется токен"));

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        socket.userId = String(decoded.userId);
        next();
    } catch (err) {
        next(new Error("Неверный токен"));
    }
});

io.on('connection', (socket) => {
    const userId = socket.userId;

    console.log(`🟢 Пользователь ${userId} подключился`);
    connectedUsers.add(userId);
    userSockets.set(userId, socket.id);
    io.emit('online_update', { online: Array.from(connectedUsers) });

    // Обновление активности
    const updateOnline = async () => {
        await redisClient.SADD('online_users', userId);
        await redisClient.EXPIRE('online_users', 60);
    };

    let activityTimeout;
    const resetTimeout = () => {
        clearTimeout(activityTimeout);
        updateOnline();
        activityTimeout = setTimeout(() => {
            connectedUsers.delete(userId);
            userSockets.delete(userId);
            io.emit('online_update', { online: Array.from(connectedUsers) });
        }, 60000);
    };

    resetTimeout();
    socket.on('send_message', resetTimeout);
    socket.on('join', resetTimeout);
    socket.on('user_active', resetTimeout);

    // Печатает
    socket.on('typing', ({ chat_id }) => {
        socket.to(`chat_${chat_id}`).emit('user_typing', { chat_id, user_id: userId });
    });

    // Отправка сообщения
    socket.on('send_message', async (data, callback) => {
        console.log('📩 [send_message] Получены данные:', JSON.stringify(data, null, 2));
        const { message_text: content, reply_to_id, chat_id } = data;
        const cid = Number(chat_id);

        if (!content || isNaN(cid)) return callback?.({ success: false, error: 'Invalid data' });

        let replyData = null;
        if (reply_to_id) {
            try {
                const [rows] = await dbPool.execute(
                    `SELECT m.content, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ? AND m.chat_id = ?`,
                    [reply_to_id, cid]
                );
                replyData = rows[0] ? {
                    reply_to: reply_to_id,
                    reply_text: rows[0].content,
                    reply_sender: rows[0].username,
                    reply_sender_id: rows[0].sender_id
                } : {
                    reply_to: reply_to_id,
                    reply_text: '[сообщение удалено]',
                    reply_sender: 'Собеседник'
                };
            } catch (err) {
                replyData = { reply_to: reply_to_id, reply_text: '[ошибка]', reply_sender: 'Собеседник' };
            }
        }

        try {
            const [r] = await dbPool.execute(
                `INSERT INTO messages (chat_id, reply_to, sender_id, content, reply_text, reply_sender) VALUES (?, ?, ?, ?, ?, ?)`,
                [cid, reply_to_id || null, userId, content, replyData?.reply_text || null, replyData?.reply_sender || null]
            );

            const msg = {
                id: r.insertId,
                chat_id: cid,
                sender_id: userId,
                content,
                sent_at: new Date().toISOString(),
                ...replyData
            };

            io.to(`chat_${cid}`).emit('new_message', msg);
            callback?.({ success: true, message_id: msg.id });
        } catch (err) {
            console.error('Ошибка отправки:', err);
            callback?.({ success: false, error: 'DB error' });
        }
    });

    socket.on('join', ({ chat_id }, cb) => {
        socket.join(`chat_${chat_id}`);
        cb?.({ success: true });
    });

    socket.on('disconnect', async () => {
        clearTimeout(activityTimeout);
        connectedUsers.delete(userId);
        userSockets.delete(userId);
        io.emit('online_update', { online: Array.from(connectedUsers) });
        await dbPool.execute(`UPDATE users SET last_seen = NOW() WHERE id = ?`, [userId]).catch(console.error);
    });
});

// === 🔹 API: Кто онлайн? ===
app.get('/api/online', async (req, res) => {
    try {
        const online = await redisClient.SMEMBERS('online_users');
        res.json({ online });
    } catch (err) {
        res.status(500).json({ online: [] });
    }
});

// === 🔹 API: Чаты пользователя ===
app.get('/api/chats', async (req, res) => {
    const { user_id: userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'user_id required' });

    try {
        const [chats] = await dbPool.execute(`
            SELECT 
                c.id AS chat_id,
                u.id AS interlocutor_id,
                u.username AS display_name,
                m.content AS last_message
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id != ?
            JOIN users u ON u.id = cp2.user_id
            LEFT JOIN messages m ON m.id = (
                SELECT MAX(id) FROM messages WHERE chat_id = c.id
            )
            WHERE cp.user_id = ?
            ORDER BY m.id DESC
        `, [userId, userId]);

        const [onlineRows] = await dbPool.execute(`
            SELECT user_id FROM user_activity 
            WHERE last_active > DATE_SUB(NOW(), INTERVAL 60 SECOND)
        `);
        const onlineIds = new Set(onlineRows.map(r => String(r.user_id)));

        const chatsWithStatus = chats.map(chat => ({
            ...chat,
            online: onlineIds.has(String(chat.interlocutor_id))
        }));

        res.json({ success: true, chats: chatsWithStatus });
    } catch (err) {
        console.error('Ошибка загрузки чатов:', err);
        res.status(500).json({ success: false, error: 'DB error' });
    }
});

// === 🔹 API: Вход → выдаём JWT ===
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    try {
        const phoneClean = username.replace(/\D/g, '');
        const [rows] = await dbPool.execute(
            phoneClean.length >= 10
                ? `SELECT id, username, password_hash FROM users WHERE phone LIKE ?`
                : `SELECT id, username, password_hash FROM users WHERE username = ?`,
            [phoneClean.length >= 10 ? `%${phoneClean}` : username]
        );

        const user = rows[0];
        if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });

        const isMatch = user.password_hash.startsWith('$2')
    ? bcrypt.compareSync(password, user.password_hash)
    : user.password_hash === password;


        if (isMatch) {
            delete user.password_hash;
            const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '7d' });
            res.json({ success: true, user, token });
        } else {
            res.status(401).json({ error: 'Неверный пароль' });
        }
    
} catch (err) {
    console.error('❌ Ошибка входа:', {
        message: err.message,
        stack: err.stack,
        type: typeof err,
        keys: Object.keys(err)
    });
   
}

});

// === 🔹 Получение участников чата ===
app.get('/api/chat_participants', async (req, res) => {
    const { chat_id } = req.query;
    if (!chat_id) return res.status(400).json({ success: false, error: 'chat_id required' });

    try {
        const [users] = await dbPool.execute(
            `SELECT u.id, u.username, u.last_seen 
             FROM chat_participants cp 
             JOIN users u ON u.id = cp.user_id 
             WHERE cp.chat_id = ?`,
            [chat_id]
        );
        res.json({ success: true, users });
    } catch (err) {
        console.error('Ошибка участников:', err);
        res.status(500).json({ success: false, error: 'DB error' });
    }
});

// === 🔹 Получение сообщений чата ===
app.get('/api/messages/get', async (req, res) => {
    const { chat_id, limit = 50, offset = 0 } = req.query;
    if (!chat_id) return res.status(400).json({ success: false, error: 'chat_id required' });

    try {
        const [messages] = await dbPool.execute(
            `SELECT 
                m.id, m.chat_id, m.sender_id, m.content, m.sent_at,
                m.reply_to, m.reply_text, m.reply_sender,
                u.username AS sender_name 
             FROM messages m 
             JOIN users u ON u.id = m.sender_id 
             WHERE m.chat_id = ? 
             ORDER BY m.id DESC 
             LIMIT ? OFFSET ?`,
            [chat_id, parseInt(limit), parseInt(offset)]
        );

        res.json({ success: true, messages });
    } catch (err) {
        console.error('Ошибка сообщений:', err);
        res.status(500).json({ success: false, error: 'DB error' });
    }
});



// === 🔹 Отметка сообщений как прочитанных ===
app.post('/api/messages/batch_read', async (req, res) => {
    const { message_ids, user_id } = req.body;
    if (!Array.isArray(message_ids) || !user_id) {
        return res.status(400).json({ success: false, error: 'Invalid data' });
    }

    try {
        for (const msgId of message_ids) {
            await dbPool.execute(
                `INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
                [msgId, user_id]
            );
            const chatId = await getChatIdByMessageId(msgId);
            if (chatId) {
                io.to(`chat_${chatId}`).emit('message_read', { message_id: msgId, user_id });
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка прочтения:', err);
        res.status(500).json({ success: false, error: 'DB error' });
    }
});

// === 🔹 Получение статуса прочтения ===
app.get('/api/messages/read_status', async (req, res) => {
    const { chat_id, message_ids, user_id } = req.query;
    if (!chat_id || !message_ids || !user_id) {
        return res.json({ read_by: {} });
    }

    const ids = message_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ids.length === 0) return res.json({ read_by: {} });

    try {
        const [reads] = await dbPool.execute(
            `SELECT message_id, user_id FROM message_reads WHERE message_id IN (?)`,
            [ids]
        );

        const readBy = {};
        for (const { message_id, user_id: reader_id } of reads) {
            if (!readBy[message_id]) readBy[message_id] = [];
            readBy[message_id].push(reader_id);
        }

        res.json({ read_by: readBy });
    } catch (err) {
        console.error('Ошибка статуса:', err);
        res.json({ read_by: {} });
    }
});

// Вспомогательная функция
async function getChatIdByMessageId(messageId) {
    const [rows] = await dbPool.execute(
        `SELECT chat_id FROM messages WHERE id = ?`,
        [messageId]
    );
    return rows[0]?.chat_id || null;
}

// Запуск сервера
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

