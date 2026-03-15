require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const db = require('./db');

const app = express();

// Разрешаем ваш домен
app.use(cors({
    origin: "https://service-taxi31.ru",
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://service-taxi31.ru",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Храним подключения
const socketUsers = new Map(); // socket → { user_id, chat_id }

io.on('connection', (socket) => {
    console.log('Пользователь подключён:', socket.id);

    // Присоединение к чату
    socket.on('join', ({ user_id, chat_id }) => {
        socket.join(`chat_${chat_id}`);
        socketUsers.set(socket, { user_id, chat_id });
        console.log(`User ${user_id} joined chat_${chat_id}`);
    });

    // Приём сообщения
    socket.on('send_message', async (data) => {
        const userInfo = socketUsers.get(socket);
        if (!userInfo) return;

        const { message_text } = data;
        const { user_id, chat_id } = userInfo;

        try {
            // Сохраняем в БД
            await db.execute(
                "INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)",
                [chat_id, user_id, message_text]
            );

            // Получаем имя пользователя
            const [rows] = await db.execute("SELECT username FROM users WHERE id = ?", [user_id]);
            const username = rows[0]?.username || 'Аноним';

            // Рассылаем всем в чате
            io.to(`chat_${chat_id}`).emit('new_message', {
                id: Date.now(), // можно заменить на lastInsertId
                chat_id,
                sender_id: user_id,
                content: message_text,
                sent_at: new Date().toISOString(),
                username
            });
        } catch (err) {
            console.error('Ошибка записи в БД:', err);
            socket.emit('error', { message: 'Не удалось отправить сообщение' });
        }
    });

    // Отключение
    socket.on('disconnect', () => {
        const userInfo = socketUsers.get(socket);
        if (userInfo) {
            const { user_id, chat_id } = userInfo;
            socket.to(`chat_${chat_id}`).emit('user_left', { user_id });
        }
        socketUsers.delete(socket);
        console.log('Пользователь отключён:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🌐 WebSocket сервер запущен на порту ${PORT}`);
});
