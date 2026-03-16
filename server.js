// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// ВАЖНО: разрешить CORS с вашего сайта
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
    // 🔥 Ключевые настройки для работы за прокси (Render, Heroku и др.)
    transports: ['polling', 'websocket'], // явно указываем
    allowEIO3: false,
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
        if (!userInfo) return socket.emit('error', { message: 'Not authorized' });

        const { message_text } = data;
        const { user_id, chat_id } = userInfo;

        try {
            const [result] = await db.execute(
                "INSERT INTO messages (chat_id, sender_id, content, sent_at) VALUES (?, ?, ?, NOW())",
                [chat_id, user_id, message_text]
            );

            const messageId = result.insertId;

            const [rows] = await db.execute("SELECT username FROM users WHERE id = ?", [user_id]);
            const username = rows[0]?.username || 'Аноним';

            io.to(`chat_${chat_id}`).emit('new_message', {
                id: messageId,
                chat_id,
                sender_id: user_id,
                content: message_text,
                sent_at: new Date().toISOString(),
                username
            });
        } catch (err) {
            console.error('🔴 Ошибка БД:', err);
            socket.emit('error', { message: 'Не удалось отправить сообщение' });
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

// ✅ Порт из переменной окружения + 0.0.0.0
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Сервер запущен на порту ${PORT}`);
});
