// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// Подключение к базе
const db = mysql.createPool({
    host: process.env.DB_HOST || 'mysql81.hostland.ru',
    user: process.env.DB_USER || 'host1874179_mess',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'host1874179_mess',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Проверка подключения
db.getConnection()
    .then(connection => {
        console.log('✅ Подключение к MySQL успешно');
        connection.release();
    })
    .catch(err => {
        console.error('🔴 Ошибка подключения к MySQL:', err.message);
    });

// Настройки CORS
app.use(cors({
    origin: "https://service-taxi31.ru",
    methods: ["GET", "POST"],
    credentials: true
}));

const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "https://service-taxi31.ru",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['polling', 'websocket'],
    cookie: false
});

// Храним: socket → { user_id, chat_id }
const socketUsers = new Map();

io.on('connection', (socket) => {
    console.log('🟢 Пользователь подключён:', socket.id);

    socket.on('join', async ({ user_id, chat_id }) => {
        socket.join(`chat_${chat_id}`);
        socketUsers.set(socket, { user_id, chat_id });
        console.log(`User ${user_id} joined chat_${chat_id}`);
    });

    socket.on('send_message', async (data) => {
        const userInfo = socketUsers.get(socket);
        if (!userInfo) {
            console.log('🔴 Не авторизован');
            return socket.emit('error', { message: 'Not authorized' });
        }

        const { message_text } = data;
        const { user_id, chat_id } = userInfo;

        if (!message_text || typeof message_text !== 'string') {
            console.log('🔴 Пустое сообщение:', message_text);
            return socket.emit('error', { message: 'Invalid message' });
        }

        try {
            console.log('✅ Вставляем в БД:', { chat_id, user_id, message_text });

            // 🔥 ИСПРАВЛЕНО: используем db, который выше
            const [result] = await db.execute(
                "INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)",
                [chat_id, user_id, message_text]
            );

            console.log('✅ Сообщение добавлено, ID:', result.insertId);

            const [rows] = await db.execute("SELECT username FROM users WHERE id = ?", [user_id]);
            const username = rows[0]?.username || 'Аноним';

            io.to(`chat_${chat_id}`).emit('new_message', {
                id: result.insertId,
                chat_id,
                sender_id: user_id,
                content: message_text,
                sent_at: new Date().toISOString(),
                username
            });

        } catch (err) {
            console.error('🔴 Ошибка БД:', err.message);
            socket.emit('error', { message: 'DB error: ' + err.message });
        }
    });

    socket.on('disconnect', () => {
        const userInfo = socketUsers.get(socket);
        if (userInfo) {
            const { user_id, chat_id } = userInfo;
            socket.to(`chat_${chat_id}`).emit('user_left', { user_id });
        }
        socketUsers.delete(socket);
        console.log('🔴 Пользователь отключён:', socket.id);
    });
});

// Порт из переменной окружения
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Сервер запущен на порту ${PORT}`);
});
