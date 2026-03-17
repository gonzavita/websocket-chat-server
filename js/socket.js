// js/socket.js
import { addMessageIfNotExists, updateMessageStatus, markAsRead, setConnectionStatus } from './ui.js';

let connectingToChatId = null;

export function connectToChat(chatId, userId) {
    // ✅ Уже подключены к этому чату — выходим
    if (window.currentChatId === chatId && window.socket?.connected) {
        console.log('🟢 Уже подключены к чату', chatId);
        return;
    }

    // ✅ Уже подключаемся — выходим
    if (connectingToChatId === chatId) {
        console.log('🚫 Уже подключаемся к чату', chatId);
        return;
    }

    connectingToChatId = chatId;

    // Отключаем предыдущее соединение
    if (window.socket) {
        window.socket.off('connect');
        window.socket.off('connect_error');
        window.socket.off('new_message');
        window.socket.off('message_delivered');
        window.socket.disconnect();
        console.log('⚠️ Отключили предыдущее соединение');
    }

    console.log('🌐 Создаём новое соединение...');
    window.socket = io('https://websocket-chat-server-lm97.onrender.com', {
        query: { user_id: userId, chat_id: chatId },
        auth: { user_id: userId, chat_id: chatId },
        transports: ['polling', 'websocket']
    });

    window.socket.on('connect', () => {
        console.log('🟢 Соединение установлено:', window.socket.id);
        window.currentChatId = chatId;
        connectingToChatId = null;
        window.socket.emit('join', { chat_id: chatId });
        setConnectionStatus('онлайн');
         // ✅ Добавь вот это:
    window.socket.on('message_read', (data) => {
        console.log('🔵 Получено прочтение:', data);
        if (String(data.user_id) === String(window.currentUser.id)) {
            updateMessageStatus(data.message_id, 'read');
        }
    });
    });

    window.socket.on('connect_error', (err) => {
        console.error('🔴 Ошибка подключения:', err);
        connectingToChatId = null;
        setConnectionStatus('оффлайн');
    });

    window.socket.on('new_message', (msg) => {
    if (!msg.id || !msg.content || !msg.sender_id || !msg.sent_at) return;

    if (msg.chat_id != window.currentChatId) return;

    // 🔎 Проверяем, нет ли уже сообщения с таким ID
    if (document.querySelector(`[data-mid="${msg.id}"]`)) {
        console.log('💬 [socket] Сообщение уже есть (дубль):', msg.id);
        return;
    }

    // 🔎 Также проверяем, не было ли временного ID (если это моё сообщение)
    const isMine = String(msg.sender_id) === String(window.currentUser.id);
    if (isMine) {
        // Если это моё сообщение — возможно, уже есть с temp_id
        const tempBubble = document.querySelector(`[data-mid^="temp_"]`);
        if (tempBubble && tempBubble.querySelector('.message').textContent === msg.content) {
            console.log('💬 [socket] Моё сообщение уже есть (temp), обновляем ID:', msg.id);
            tempBubble.dataset.mid = msg.id;
            updateMessageStatus(msg.id, 'delivered');
            return;
        }
    }

    // ✅ Добавляем только если нет
    addMessageIfNotExists(
        msg.content,
        isMine,
        new Date(msg.sent_at),
        'delivered',
        msg.id
    );

    if (!isMine) {
        markAsRead(msg.id, window.currentUser.id);
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
    // Проверим, нет ли уже такого сообщения по тексту
const existing = Array.from(document.querySelectorAll('[data-mid^="temp_"], [data-mid]'))
    .find(b => b.querySelector('.message')?.textContent === text);

if (existing) {
    console.log('💬 [send] Сообщение уже есть (по тексту), пропускаем:', text);
    return;
}

addMessageIfNotExists(text, true, new Date(), 'sent', tempId);


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
