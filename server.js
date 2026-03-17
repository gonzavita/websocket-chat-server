// server.js — Полная версия с API + MySQL + Socket.IO

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "https://service-taxi31.ru",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.json());

// 🔌 Настройка MySQL
let db;
(async () => {
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST || 'host1874179.hostland.pro',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'host1874179_mess',
            password: process.env.DB_PASS || '111111',
            database: process.env.DB_NAME || 'host1874179_mess'
        });
        console.log('✅ Подключились к MySQL');
    } catch (err) {
        console.error('❌ Ошибка подключения к MySQL:', err.message);
    }
})();

// Храним online пользователей
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
    const userId = socket.userId;

    console.log(`🟢 Пользователь ${userId} подключился`);
    connectedUsers.add(userId);
    userSockets.set(userId, socket.id);

    io.emit('online_update', { online: Array.from(connectedUsers) });

    socket.on('user_active', async () => {
        try {
            await db.execute(`UPDATE users SET last_seen = NOW() WHERE id = ?`, [userId]);
            console.log(`⏱️  last_seen обновлён для ${userId}`);
        } catch (err) {
            console.warn('Не удалось обновить last_seen:', err.message);
        }
    });

    socket.on('send_message', async (data, callback) => {
        const { message_text: content } = data;
        const chatId = socket.handshake.query.chat_id;

        if (!content || !chatId) {
            return callback?.({ success: false, error: 'Invalid data' });
        }

        try {
            const [result] = await db.execute(
                `INSERT INTO messages (chat_id, sender_id, content, sent_at) VALUES (?, ?, ?, NOW())`,
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

    socket.on('join', ({ chat_id }) => {
        socket.join(`chat_${chat_id}`);
        console.log(`👤 ${userId} присоединился к чату ${chat_id}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔴 Пользователь ${userId} отключился`);
        connectedUsers.delete(userId);
        userSockets.delete(userId);
        io.emit('online_update', { online: Array.from(connectedUsers) });
    });
});

// === API: Кто онлайн? ===
app.get('/api/online', (req, res) => {
    res.json({ online: Array.from(connectedUsers) });
});

// === API: Чаты пользователя ===
app.get('/api/chats', async (req, res) => {
    const userId = req.query.user_id;
    try {
        const [chats] = await db.execute(`
            SELECT c.id, u.username AS display_name, m.content AS last_message
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

        res.json({ success: true, chats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API: Создать чат ===
app.post('/api/chats', async (req, res) => {
    const { user_id, interlocutor_id } = req.body;
    const [existing] = await db.execute(`
        SELECT c.id FROM chats c
        JOIN chat_participants cp1 ON c.id = cp1.chat_id
        JOIN chat_participants cp2 ON c.id = cp2.chat_id
        WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.type = 'private'
    `, [user_id, interlocutor_id]);

    if (existing.length > 0) {
        return res.json({ success: true, chat_id: existing[0].id });
    }

    const [result] = await db.execute(
        `INSERT INTO chats (type, creator_id) VALUES ('private', ?)`,
        [user_id]
    );
    const chatId = result.insertId;

    await db.execute(
        `INSERT INTO chat_participants (user_id, chat_id) VALUES (?, ?), (?, ?)`,
        [user_id, chatId, interlocutor_id, chatId]
    );

    res.json({ success: true, chat_id: chatId });
});

// === API: Сообщения в чате ===
app.get('/api/messages', async (req, res) => {
    const { action, chat_id, message_ids, user_id } = req.query;

    if (action === 'read_status') {
        const ids = message_ids.split(',').map(Number);
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await db.execute(
            `SELECT message_id, user_id FROM message_reads WHERE message_id IN (${placeholders})`,
            ids
        );

        const readBy = {};
        ids.forEach(id => (readBy[id] = []));
        rows.forEach(row => readBy[row.message_id].push(row.user_id));

        return res.json({ read_by: readBy });
    }

    const [messages] = await db.execute(
        `SELECT * FROM messages WHERE chat_id = ? ORDER BY sent_at ASC`,
        [chat_id]
    );

    res.json({ messages });
});

// === API: Отметить как прочитанное ===
app.post('/api/messages', async (req, res) => {
    const { action, message_id, user_id } = req.body;
    if (action !== 'read') return res.status(400).json({});

    try {
        await db.execute(
            `INSERT IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, NOW())`,
            [message_id, user_id]
        );

        io.emit('message_read', { message_id: Number(message_id), user_id: Number(user_id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// === API: Участники чата ===
app.get('/api/chat_participants', async (req, res) => {
    const { chat_id } = req.query;
    const [users] = await db.execute(`
        SELECT u.id, u.username, u.last_seen FROM users u
        JOIN chat_participants cp ON u.id = cp.user_id
        WHERE cp.chat_id = ?
    `, [chat_id]);

    const withOnline = users.map(u => ({
        ...u,
        online: new Date(u.last_seen) > new Date(Date.now() - 30000)
    }));

    res.json({ success: true, users: withOnline });
});

// === API: Поиск пользователей ===
app.get('/api/search_users', async (req, res) => {
    const { q, user_id } = req.query;
    const [users] = await db.execute(
        `SELECT id, username, last_seen FROM users WHERE id != ? AND username LIKE ? LIMIT 10`,
        [user_id, `%${q}%`]
    );

    const withOnline = users.map(u => ({
        ...u,
        online: new Date(u.last_seen) > new Date(Date.now() - 30000)
    }));

    res.json({ users: withOnline });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
