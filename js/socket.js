// js/socket.js
import { updateMessageStatus, markAsRead, setConnectionStatus } from './ui.js'; // ✅ импортировано

let connectingToChatId = null;

export function connectToChat(chatId, userId) {
    if (connectingToChatId === chatId || window.currentChatId === chatId) {
        return;
    }

    connectingToChatId = chatId;

    if (window.socket) {
        window.socket.off('new_message');
        window.socket.off('message_delivered');
        window.socket.off('connect');
        window.socket.off('connect_error');
        window.socket.disconnect();
    }

    window.socket = io('https://websocket-chat-server-lm97.onrender.com', {
        query: { user_id: userId, chat_id: chatId },
        auth: { user_id: userId, chat_id: chatId },
        transports: ['polling', 'websocket']
    });

    window.socket.on('connect', () => {
        window.currentChatId = chatId;
        connectingToChatId = null;
        console.log('[socket] Подключено, присоединяемся к чату:', chatId);
        window.socket.emit('join', { chat_id: chatId });
        setConnectionStatus('онлайн');
    });

    window.socket.on('connect_error', (err) => {
        console.warn('Socket error:', err.message);
        connectingToChatId = null;
        setConnectionStatus('оффлайн');
    });

    window.socket.on('new_message', (msg) => {
        if (!msg.id || !msg.content || !msg.sender_id || !msg.sent_at) return;

        if (msg.chat_id == window.currentChatId) {
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

    window.socket.on('message_delivered', (data) => {
        updateMessageStatus(data.message_id, 'delivered');
    });
}

export function sendMessage(text) {
    if (!window.currentChatId) {
        console.warn('[socket] currentChatId не установлен');
        return;
    }

    const tempId = 'temp_' + Date.now();
    window.giga_addMessage(text, true, new Date(), 'sent', tempId);

    console.log('[socket] Отправка:', { text, chatId: window.currentChatId });

    const trySend = () => {
        if (!window.socket) {
            console.warn('[socket] Сокет не инициализирован');
            setTimeout(trySend, 100);
            return;
        }

        if (!window.socket.connected) {
            console.log('[socket] Ожидание подключения...');
            setTimeout(trySend, 100);
            return;
        }

        window.socket.emit('send_message', { message_text: text }, (ack) => {
            console.log('[socket] ACK получен:', ack);
            if (ack && ack.success && ack.message_id) {
                updateMessageStatus(tempId, 'delivered');
                const bubble = document.querySelector(`[data-mid="${tempId}"]`);
                if (bubble) bubble.dataset.mid = ack.message_id;
            } else {
                console.error('[socket] Отправка не удалась:', ack);
            }
        });
    };

    trySend();
}

export function disconnect() {
    if (window.socket) {
        window.socket.disconnect();
        window.socket = null;
    }
    connectingToChatId = null;
}

export function sendUserActive() {
    if (window.socket?.connected) {
        window.socket.emit('user_active');
    }
}

export function getSocketState() {
    return window.socket ? {
        connected: window.socket.connected,
        id: window.socket.id,
        chatId: window.currentChatId
    } : null;
}
