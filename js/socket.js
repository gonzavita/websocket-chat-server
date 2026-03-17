// js/socket.js
import { updateMessageStatus, markAsRead } from './ui.js';

let currentChatId = null;
let socket = null;
let connectingToChatId = null;

export function connectToChat(chatId, userId) {
    if (connectingToChatId === chatId || currentChatId === chatId) {
        return; // Уже подключены или подключаемся
    }

    connectingToChatId = chatId;

    if (socket) {
        socket.off('new_message');
        socket.off('message_delivered');
        socket.off('connect');
        socket.off('connect_error');
        socket.disconnect();
    }

    socket = io('https://websocket-chat-server-lm97.onrender.com', {
        query: { user_id: userId, chat_id: chatId },
        auth: { user_id: userId, chat_id: chatId },
        transports: ['polling', 'websocket']
    });

    window.socket = socket;

    socket.on('connect', () => {
        currentChatId = chatId;
        connectingToChatId = null;
    });

    socket.on('connect_error', (err) => {
        console.warn('Socket error:', err.message);
        connectingToChatId = null;
    });

    socket.on('new_message', (msg) => {
        if (!msg.id || !msg.content || !msg.sender_id || !msg.sent_at) return;

        if (msg.chat_id == currentChatId) {
            const isMine = String(msg.sender_id) === String(window.currentUser.id);

            window.giga_addMessage(
                msg.content,
                isMine,
                new Date(msg.sent_at),
                'delivered',
                msg.id
            );

            if (!isMine) {
                markAsRead(msg.id, window.currentUser.id);
            }
        }
    });

    socket.on('message_delivered', (data) => {
        updateMessageStatus(data.message_id, 'delivered');
    });
}

export function sendMessage(text) {
    if (!socket) {
        console.warn('[socket] Сокет не инициализирован');
        return;
    }
    if (!currentChatId) {
        console.warn('[socket] currentChatId не установлен');
        return;
    }
    if (!socket.connected) {
        console.warn('[socket] Не подключено к серверу');
        return;
    }

    const tempId = 'temp_' + Date.now();
    window.giga_addMessage(text, true, new Date(), 'sent', tempId);

    console.log('[socket] Отправка:', { text, chatId: currentChatId });

    socket.emit('send_message', { message_text: text }, (ack) => {
        console.log('[socket] ACK получен:', ack); // 🔴 Вот этот лог ОБЯЗАН появиться
        if (ack && ack.success && ack.message_id) {
            updateMessageStatus(tempId, 'delivered');
            const bubble = document.querySelector(`[data-mid="${tempId}"]`);
            if (bubble) bubble.dataset.mid = ack.message_id;
        } else {
            console.error('[socket] Отправка не удалась:', ack);
        }
    });
}



export function disconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    currentChatId = null;
    connectingToChatId = null;
}

// Для активности пользователя
export function sendUserActive() {
    if (socket?.connected) {
        socket.emit('user_active');
    }
}

// Для отладки состояния
export function getSocketState() {
    return socket ? {
        connected: socket.connected,
        id: socket.id,
        chatId: currentChatId
    } : null;
}
