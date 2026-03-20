// server.js — Полная, безопасная, масштабируемая версия

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise'); // ← используем promise-версию
const bcrypt = require('bcrypt');

const app = express();

// CORS вручную
app.use((req, res, next) => {
    const allowedOrigin = 'https://service-taxi31.ru';
    const origin = req.headers.origin;

    if (origin === allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "https://service-taxi31.ru", credentials: true }
});

// 🔌 Подключение к MySQL через ПУЛ (вместо одного соединения)
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
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });

        // Проверка подключения
        await dbPool.getConnection();
        console.log('✅ Подключились к MySQL через пул');
    } catch (err) {
        console.error('❌ Ошибка подключения к MySQL:', err.message);
    }
})();

// Онлайн пользователи
const connectedUsers = new Set();
const userSockets = new Map();

// Middleware: проверка user_id
io.use((socket, next) => {
    const userId = socket.handshake.query.user_id;
    if (!userId) return next(new Error("User ID required"));
    socket.userId = userId;
    next();
});

io.on('connection', (socket) => {
    const userId = String(socket.userId);

    console.log(`🟢 Пользователь ${userId} подключился`);
    connectedUsers.add(userId);
    userSockets.set(userId, socket.id);

    // Рассылаем обновление онлайна
    io.emit('online_update', { online: Array.from(connectedUsers) });

    // Таймер: пользователь оффлайн через 60 сек без активности
    let userTimeout;

    function resetTimeout() {
    clearTimeout(userTimeout);
userTimeout = setTimeout(() => {
    console.log(`⏱️ Пользователь ${userId} отключен по таймауту`);
    connectedUsers.delete(userId);
    userSockets.delete(userId);
    io.emit('online_update', { online: Array.from(connectedUsers) });
}, 60000);

// 🔁 Умное обновление last_active — не чаще чем раз в 30 сек
(async () => {
    try {
        const [rows] = await dbPool.execute(
            `SELECT last_active FROM user_activity WHERE user_id = ?`,
            [userId]
        );

        const now = new Date();
        if (rows.length > 0) {
            const lastActive = new Date(rows[0].last_active);
            const diffSec = (now - lastActive) / 1000;
            if (diffSec < 30) return; // Не обновляем, если меньше 30 сек
        }

        // Обновляем только если прошло достаточно времени
        await dbPool.execute(
            `INSERT INTO user_activity (user_id, last_active) VALUES (?, NOW())
             ON DUPLICATE KEY UPDATE last_active = NOW()`,
            [userId]
        );
    } catch (err) {
        console.error('Ошибка обновления активности:', err);
    }
})();

}


    resetTimeout();

    // События, сбрасывающие таймер
    socket.on('send_message', resetTimeout);
    socket.on('join', resetTimeout);
    socket.on('user_active', resetTimeout);

    // Отправка сообщения
    socket.on('send_message', async (data, callback) => {
        console.log('📩 Получено сообщение:', data);
        const { message_text: content } = data;
        const chatId = socket.handshake.query.chat_id;

        if (!content || !chatId) {
            return callback?.({ success: false, error: 'Invalid data' });
        }

        try {
            const [result] = await dbPool.execute(
                `INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)`,
                [chatId, userId, content]
            );

            const message = {
                id: result.insertId,
                chat_id: Number(chatId),
                sender_id: Number(userId),
                content,
                sent_at: new Date().toISOString()
            };

            io.to(`chat_${chatId}`).emit('new_message', message);
            callback?.({ success: true, message_id: message.id });
        } catch (err) {
            console.error('Ошибка отправки:', err);
            callback?.({ success: false, error: 'DB error' });
        }
    });

    // Присоединение к чату
    socket.on('join', ({ chat_id }) => {
        socket.join(`chat_${chat_id}`);
        console.log(`👤 ${userId} присоединился к чату ${chat_id}`);
    });

    // Отключение
    socket.on('disconnect', () => {
        clearTimeout(userTimeout);
        console.log(`🔴 Пользователь ${userId} отключился`);

        if (connectedUsers.has(userId)) {
            connectedUsers.delete(userId);
            userSockets.delete(userId);
            io.emit('online_update', { online: Array.from(connectedUsers) });
        }

        // Обновляем last_seen при выходе
        dbPool.execute(`UPDATE users SET last_seen = NOW() WHERE id = ?`, [userId]).catch(console.error);
    });
});

// === API: Кто онлайн? ===
app.get('/api/online', async (req, res) => {
    try {
        const [rows] = await dbPool.execute(`
            SELECT user_id FROM user_activity 
            WHERE last_active > DATE_SUB(NOW(), INTERVAL 60 SECOND)
        `);
        const online = rows.map(r => String(r.user_id));
        res.json({ online });
    } catch (err) {
        console.error('Ошибка /api/online:', err);
        res.status(500).json({ online: [] });
    }
});

// === API: Чаты пользователя ===
app.get('/api/chats', async (req, res) => {
    const userId = req.query.user_id;
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

        // 🔽 Получаем онлайн-статус
        const [onlineRows] = await dbPool.execute(`
            SELECT user_id FROM user_activity 
            WHERE last_active > DATE_SUB(NOW(), INTERVAL 60 SECOND)
        `);
        const onlineIds = new Set(onlineRows.map(r => String(r.user_id)));

        // 🔽 Добавляем .online
        const chatsWithStatus = chats.map(chat => ({
            ...chat,
            online: onlineIds.has(String(chat.interlocutor_id))
        }));

        res.json({ success: true, chats: chatsWithStatus });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// === API: Получить сообщения ===
app.get('/api/messages/get', async (req, res) => {
    const { chat_id } = req.query;
    try {
        const [messages] = await dbPool.execute(`
            SELECT m.*, u.username FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.sent_at ASC
        `, [chat_id]);
        res.json({ success: true, messages });
    } catch (err) {
        console.error('Ошибка загрузки сообщений:', err);
        res.status(500).json({ success: false, error: 'DB error' });
    }
});

// === API: Статус прочтения ===
app.get('/api/messages/read_status', async (req, res) => {
    const { chat_id, message_ids, user_id } = req.query;
    const ids = (message_ids || '').split(',').map(Number).filter(id => id > 0);

    if (!chat_id || !user_id || ids.length === 0) {
        return res.json({ read_by: {} });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await dbPool.execute(`
            SELECT mr.message_id, mr.user_id
            FROM message_reads mr
            JOIN messages m ON mr.message_id = m.id
            WHERE m.chat_id = ? AND mr.message_id IN (${placeholders})
        `, [chat_id, ...ids]);

        const readBy = {};
        ids.forEach(id => (readBy[id] = []));
        rows.forEach(row => readBy[row.message_id].push(row.user_id));

        res.json({ read_by: readBy });
    } catch (err) {
        console.error('Ошибка read_status:', err);
        res.status(500).json({ read_by: {} });
    }
});

// === API: Отметить как прочитанное ===
app.post('/api/messages/read', async (req, res) => {
    const { message_id, user_id } = req.body;
    if (!message_id || !user_id) {
        return res.status(400).json({ success: false });
    }

    try {
        await dbPool.execute(
            `INSERT IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, NOW())`,
            [message_id, user_id]
        );
        io.emit('message_read', { message_id: Number(message_id), user_id: Number(user_id) });
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка отметки прочтения:', err);
        res.status(500).json({ success: false });
    }
});

// === API: Массовое прочтение ===
app.post('/api/messages/batch_read', async (req, res) => {
    const { message_ids, user_id } = req.body;
    if (!Array.isArray(message_ids) || message_ids.length === 0 || !user_id) {
        return res.status(400).json({ success: false });
    }

    try {
        const placeholders = Array(message_ids.length).fill('?').join(',');
        const [validMessages] = await dbPool.execute(`
            SELECT m.id, m.chat_id FROM messages m
            JOIN chat_participants cp ON m.chat_id = cp.chat_id
            WHERE m.id IN (${placeholders}) AND cp.user_id = ?
        `, [...message_ids, user_id]);


        const validIds = validMessages.map(m => m.id);
        if (validIds.length === 0) {
            console.log(`🟡 Нет доступных сообщений для прочтения: user=${user_id}`);
            return res.json({ success: true });
        }

        const chatId = validMessages[0].chat_id;

        // Получаем всех, кроме текущего пользователя
        const [participants] = await dbPool.execute(
            `SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?`,
            [chatId, user_id]
        );

        // Массово вставляем в message_reads
        const readPlaceholders = validIds.map(() => '(?, ?, NOW())').join(',');
        const readValues = validIds.flatMap(id => [id, user_id]);

        await dbPool.execute(`
            INSERT IGNORE INTO message_reads (message_id, user_id, read_at) VALUES ${readPlaceholders}
        `, readValues);

        // Отправляем ТОЛЬКО собеседникам
        participants.forEach(participant => {
            const sockId = userSockets.get(String(participant.user_id));
            if (sockId) {
                validIds.forEach(id => {
                    console.log(`📤 СЕРВЕР: отправлено message_read(${id}) от user=${user_id} → user=${participant.user_id}`);
                    io.to(sockId).emit('message_read', {
                        message_id: id,
                        user_id: Number(user_id)
                    });
                });
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('batch_read error:', err);
        res.status(500).json({ success: false });
    }
});




// === API: Участники чата ===
app.get('/api/chat_participants', async (req, res) => {
    const { chat_id } = req.query;
    const [users] = await dbPool.execute(`
        SELECT u.id, u.username, u.last_seen FROM users u
        JOIN chat_participants cp ON u.id = cp.user_id
        WHERE cp.chat_id = ?
    `, [chat_id]);

    const [onlineRows] = await dbPool.execute(`
        SELECT user_id FROM user_activity 
        WHERE last_active > DATE_SUB(NOW(), INTERVAL 60 SECOND)
    `);
    const onlineIds = new Set(onlineRows.map(r => String(r.user_id)));

    const withOnline = users.map(u => ({
        ...u,
        online: onlineIds.has(String(u.id))
    }));

    res.json({ success: true, users: withOnline });
});

// === API: Поиск пользователей ===
app.get('/api/search_users', async (req, res) => {
    const { q, user_id } = req.query;
    const [users] = await dbPool.execute(`
        SELECT id, username, last_seen FROM users 
        WHERE id != ? AND username LIKE ? LIMIT 10
    `, [user_id, `%${q}%`]);

    const [onlineRows] = await dbPool.execute(`
        SELECT user_id FROM user_activity 
        WHERE last_active > DATE_SUB(NOW(), INTERVAL 60 SECOND)
    `);
    const onlineIds = new Set(onlineRows.map(r => String(r.user_id)));

    const withOnline = users.map(u => ({
        ...u,
        online: onlineIds.has(String(u.id))
    }));

    res.json({ users: withOnline });
});

// === API: Вход ===
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    try {
        let user;
        const phoneClean = username.replace(/\D/g, '');
        if (phoneClean.length >= 10) {
            const [rows] = await dbPool.execute(`SELECT id, username, email, phone, password_hash FROM users WHERE phone LIKE ?`, [`%${phoneClean}`]);
            user = rows[0];
        } else {
            const [rows] = await dbPool.execute(`SELECT id, username, email, phone, password_hash FROM users WHERE username = ?`, [username]);
            user = rows[0];
        }

        if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });

        let isMatch = false, needsRehash = false;
        if (user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$')) {
            isMatch = bcrypt.compareSync(password, user.password_hash);
        } else {
            if (user.password_hash === password) {
                isMatch = true;
                needsRehash = true;
            }
        }

        if (isMatch) {
            delete user.password_hash;
            await dbPool.execute(`UPDATE users SET last_seen = NOW() WHERE id = ?`, [user.id]);
            if (needsRehash) {
                const newHash = bcrypt.hashSync(password, 10);
                await dbPool.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, user.id]);
            }
            return res.json({ success: true, user });
        } else {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
    } catch (err) {
        console.error('Ошибка входа:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// === API: Регистрация ===
app.post('/api/register', async (req, res) => {
    const { username, email, phone, password } = req.body;
    if (!username || !email || !phone || !password) return res.status(400).json({ error: 'Все поля обязательны' });

    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length !== 11 || !phoneClean.startsWith('7')) return res.status(400).json({ error: 'Некорректный номер телефона' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });

    try {
        const [existing] = await dbPool.execute(`SELECT id FROM users WHERE username = ? OR phone = ?`, [username, phoneClean]);
        if (existing.length > 0) return res.status(409).json({ error: 'Логин или телефон уже заняты' });

        const hash = bcrypt.hashSync(password, 10);
        const [result] = await dbPool.execute(
            `INSERT INTO users (username, email, phone, password_hash, last_seen) VALUES (?, ?, ?, ?, NOW())`,
            [username, email, phoneClean, hash]
        );

        const userId = result.insertId;
        const user = { id: userId, username, email, phone: phoneClean };
        return res.json({ success: true, user });
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
