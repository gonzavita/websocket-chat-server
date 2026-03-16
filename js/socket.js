// js/socket.js
let socket = null;
let currentChatId = null;

/**
 * Подключиться к чату
 */
export function connectToChat(chatId, userId) {
    if (socket) disconnect();

    // Подключаемся к серверу
    socket = io('https://websocket-chat-server.onrender.com', {
        query: { user_id: userId }
    });

    currentChatId = chatId;

    // Присоединяемся к комнате чата
    socket.emit('join', { user_id: userId, chat_id: chatId });

    console.log(`Подключились к чату ${chatId}`);

    // Слушаем новые сообщения
    socket.on('new_message', (msg) => {
        console.log('📩 Получено сообщение:', msg);

        // Только если это текущий чат
        if (msg.chat_id == currentChatId) {
            window.addMessageLocally(msg);
        }
    });

    socket.on('error', (err) => {
        console.error('Ошибка сокета:', err);
    });
}

/**
 * Отправить сообщение
 */
export function sendMessage(text) {
    if (!socket || !currentChatId) return;

    socket.emit('send_message', {
        message_text: text
    });
}

/**
 * Отключиться
 */
export function disconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
