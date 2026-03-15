const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();

// Разрешаем доступ с вашего сайта
app.use(cors({
    origin: "https://service-taxi31.ru",
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://service-taxi31.ru",
        methods: ["GET", "POST"]
    }
});

// Храним подключения пользователей: socket.id → { user_id, chat_id }
const userSockets = new Map();
const socketUsers = new Map(); // socket → user info

io.on('connection', (socket) => {
    console.log('Пользователь подключён:', socket.id);

    // Присоединение к чату
    socket.on('join', ({ user_id, chat_id }) => {
        userSockets.set(socket.id, { user_id, chat_id });
        socketUsers.set(socket, { user_id, chat_id });

        socket.join(`chat_${chat_id}`);
        console.log(`User ${user_id} joined chat_${chat_id}`);

        // Оповещаем других о новом сообщении
        socket.to(`chat_${chat_id}`).emit('user_joined', {
            user_id,
            message: 'пользователь подключился'
        });
    });

    // Приём сообщения
    socket.on('send_message', async (data) => {
        const userInfo = socketUsers.get(socket);
        if (!userInfo) return;

        const { message_text } = data;
        const { user_id, chat_id } = userInfo;

        // Здесь можно вставить в БД, если нужно
        // Например: INSERT INTO messages...

        // Рассылаем всем в чате
        io.to(`chat_${chat_id}`).emit('new_message', {
            id: Date.now(), // временный ID
            chat_id,
            sender_id: user_id,
            content: message_text,
            sent_at: new Date().toISOString(),
            username: data.username || 'Аноним'
        });
    });

    // Отключение
    socket.on('disconnect', () => {
        const userInfo = socketUsers.get(socket);
        if (userInfo) {
            const { user_id, chat_id } = userInfo;
            socket.to(`chat_${chat_id}`).emit('user_left', { user_id });
        }
        userSockets.delete(socket.id);
        socketUsers.delete(socket);
        console.log('Пользователь отключён:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`WebSocket сервер запущен на порту ${PORT}`);
});
