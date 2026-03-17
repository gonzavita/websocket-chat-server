const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { v4: uuidv4 } = require('uuid'); // ✅ Перенесли наверх



const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "https://service-taxi31.ru",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Храним подключённых пользователей
const connectedUsers = new Set(); // user_id
const userSockets = new Map();     // user_id → socket.id

// Middleware: логируем подключение
io.use((socket, next) => {
    const userId = socket.handshake.query.user_id;
    if (!userId) {
        console.warn('❌ Подключение без user_id');
        return next(new Error('User ID required'));
    }
    socket.userId = userId;
    next();
});

io.on('connection', (socket) => {
    const userId = socket.userId;

    console.log(`🟢 Пользователь ${userId} подключился`);

    // Добавляем в онлайн
    connectedUsers.add(userId);
    userSockets.set(userId, socket.id);

    // Уведомляем всех об обновлении онлайн-списка (опционально)
    io.emit('online_update', { online: Array.from(connectedUsers) });

    // Когда клиент сообщает, что он активен
    socket.on('user_active', async () => {
        try {
            await fetch('https://service-taxi31.ru/api/update_status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            console.log(`⏱️  Обновлён last_seen для пользователя ${userId}`);
        } catch (err) {
            console.warn(`⚠️ Не удалось обновить статус для ${userId}:`, err.message);
        }
    });

    // Приход нового сообщения
    socket.on('send_message', async (data) => {
        const { message_text: content } = data;
        const chatId = socket.handshake.query.chat_id;

        if (!content || !chatId) return;

        // Отправляем сообщение всем в чате
        io.to(`chat_${chatId}`).emit('new_message', {
            id: uuidv4(), // временный ID, лучше генерировать на бэкенде
            chat_id: chatId,
            sender_id: userId,
            content: content,
            sent_at: new Date().toISOString(),
            username: data.username || 'User'
        });
    });

    // Присоединение к чату
    socket.on('join', (data) => {
        const { chat_id } = data;
        socket.join(`chat_${chat_id}`);
        console.log(`👤 ${userId} присоединился к чату ${chat_id}`);
    });

    // Отключение
    socket.on('disconnect', () => {
        console.log(`🔴 Пользователь ${userId} отключился`);
        connectedUsers.delete(userId);
        userSockets.delete(userId);
        io.emit('online_update', { online: Array.from(connectedUsers) });
    });
});

// Эндпоинт: кто онлайн (GET /api/online)
app.get('/api/online', (req, res) => {
    res.json({ online: Array.from(connectedUsers) });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
