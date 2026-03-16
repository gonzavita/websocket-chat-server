// js/socket.js
let socket = null;
let currentChatId = null;

export function connectToChat(chatId, userId) {
    if (socket) disconnect();

    // 🔥 ПРАВИЛЬНЫЙ URL
    socket = io('https://websocket-chat-server-lm97.onrender.com', {
        query: { user_id: userId },
        transports: ['polling', 'websocket'] // ⬅️ обязательно
    });

    currentChatId = chatId;

    socket.emit('join', { user_id: userId, chat_id: chatId });
    console.log(`Подключились к чату ${chatId}`);

    socket.on('new_message', (msg) => {
        console.log('📩 Получено:', msg);
        if (msg.chat_id == currentChatId) {
            window.addMessageLocally(msg);
        }
    });

    socket.on('connect_error', (err) => {
        console.error('🔴 Ошибка подключения:', err.message);
    });

    socket.on('connect', () => {
        console.log('✅ Успешно подключились к серверу!');
    });
}

export function sendMessage(text) {
    if (!socket || !currentChatId) return;
    socket.emit('send_message', { message_text: text });
}

export function disconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
