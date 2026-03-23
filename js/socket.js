// js/socket.js
import { addMessageIfNotExists, updateMessageStatus, updateMessageId, generateTempId, knownReadStatus } from './ui.js';

if ('Notification' in window) {
    Notification.requestPermission();
}

function showNotification(username, message) {
    if (Notification.permission === 'granted') {
        new Notification(`${username}`, {
            body: message,
            icon: '/favicon.ico'
        });
    }
}

let pendingChatId = null;

export function connectToChat(chatId, userId) {
    if (!userId) {
        console.error('❌ Не указан user_id');
        return;
    }

    pendingChatId = chatId;
    window.currentChatId = chatId;
    window.currentUser = { id: userId };

    const token = localStorage.getItem('authToken') ||
                  (JSON.parse(localStorage.getItem('currentUser') || '{}').token);

    if (!token) {
        console.error('❌ Нет JWT токена');
        return;
    }

    if (window.socket && window.socket.connected) {
        window.socket.emit('join', { chat_id: chatId });
        import('./ui.js').then(m => m.setConnectionStatus());
        return;
    }

    if (window.socket) {
        console.log('🟡 Сокет уже инициализирован, ожидаем подключения...');
        return;
    }

    console.log('🌐 Инициализация сокета: https://service-taxi31.ru');
    window.socket = io('https://service-taxi31.ru', {
        auth: { token },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        timeout: 20000
    });

    window.socket.on('connect', () => {
        console.log('🟢 Сокет подключён:', window.socket.id);
        const chatId = pendingChatId || window.currentChatId;
        if (chatId) {
            window.socket.emit('join', { chat_id: chatId });
            import('./ui.js').then(m => m.setConnectionStatus());
        }
    });

    window.socket.on('reconnect', () => {
        console.log('🔁 Переподключились');
        if (window.currentChatId) {
            window.socket.emit('join', { chat_id: window.currentChatId });
            import('./ui.js').then(m => m.setConnectionStatus());
        }
    });

    window.socket.on('connect_error', (err) => {
        console.error('❌ Ошибка подключения:', err.message || err);
    });

    window.socket.on('disconnect', (reason) => {
        console.log('🔴 Сокет отключён:', reason);
    });

    window.socket.on('new_message', (msg) => {
        const isMine = String(msg.sender_id) === String(window.currentUser.id);
        if (isMine) return;

        let replyOptions = {};
        if (msg.reply_to) {
            const isReplyMine = String(msg.reply_sender_id) === String(window.currentUser.id);
            const senderName = isReplyMine ? 'Вы' : (document.getElementById('chatHeader')?.textContent || 'Собеседник');
            replyOptions = {
                reply_to: msg.reply_to,
                reply_text: msg.reply_text,
                reply_sender: senderName
            };
        }

        import('./ui.js').then(m => m.addMessageIfNotExists(
            msg.content,
            false,
            new Date(msg.sent_at),
            'received',
            msg.id,
            replyOptions
        ));

        getInterlocutorName(msg.chat_id).then(name => {
            showNotification(name, msg.content);
        });
    });

    window.socket.on('message_read', (data) => {
        if (String(data.user_id) !== String(window.currentUser.id)) {
            import('./ui.js').then(m => m.updateMessageStatus(data.message_id, 'read'));
        }
    });

    window.socket.on('online_update', () => {
        if (window.currentChatId) {
            import('./ui.js').then(m => m.setConnectionStatus());
        }
        if (typeof window.loadChats === 'function') {
            window.loadChats();
        }
    });

    window.socket.on('user_typing', (data) => {
        const interlocutorName = document.getElementById('chatHeader')?.textContent || 'Собеседник';
        const typingEl = document.getElementById('typing-indicator');
        if (!typingEl) return;

        typingEl.textContent = `${interlocutorName} печатает...`;
        typingEl.classList.remove('hidden');

        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
            typingEl.classList.add('hidden');
        }, 1500);
    });
}

async function getInterlocutorName(chatId) {
    try {
        const res = await fetch(`/api/chat_participants?chat_id=${chatId}`);
        const data = await res.json();
        const interlocutor = data.users?.find(u => u.id !== window.currentUser.id);
        return interlocutor?.username || 'Собеседник';
    } catch (err) {
        console.warn('Не удалось получить имя собеседника:', err);
        return 'Собеседник';
    }
}

export async function getParticipants(chatId) {
    try {
        const res = await fetch(`/api/chat_participants?chat_id=${chatId}`);
        return await res.json();
    } catch (err) {
        console.error('Ошибка получения участников:', err);
        return { success: false, users: [] };
    }
}

export async function getReadStatus(chatId, messageIds) {
    try {
        const res = await fetch(`/api/messages/read_status?chat_id=${chatId}&message_ids=${messageIds.join(',')}&user_id=${window.currentUser.id}`);
        const data = await res.json();
        const statuses = {};
        for (const msgId of messageIds) {
            const readers = data.read_by[msgId] || [];
            // 🔹 Проверяем кэш: если уже помечено как read — не возвращаем delivered
            if (knownReadStatus.has(String(msgId))) {
                statuses[msgId] = 'read';
            } else {
                statuses[msgId] = readers.includes(String(window.currentUser.id)) ? 'read' : 'delivered';
            }
        }
        return statuses;
    } catch (err) {
        console.error('Ошибка статуса прочтения:', err);
        return {};
    }
}

export async function markAllReceivedAsRead(chatId) {
    try {
        const messages = document.querySelectorAll(`[data-mid][data-sent="false"]`);
        const receivedIds = Array.from(messages)
            .map(el => parseInt(el.dataset.mid))
            .filter(id => !isNaN(id));

        if (receivedIds.length === 0) return;

        await fetch('/api/messages/batch_read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_ids: receivedIds, user_id: window.currentUser.id })
        });

        // 🔹 Убрали локальное обновление
        // Теперь статус придёт через `message_read` или следующий `getReadStatus`
    } catch (err) {
        console.error('Ошибка отметки прочитанных:', err);
    }
}

export async function sendMessage(text, chatId, replyToId = null) {
    const socket = window.socket;
    if (!socket?.connected) {
        throw new Error('Сокет не подключён');
    }

    if (window.currentChatId !== chatId) {
        window.currentChatId = chatId;
    }

    const tempId = generateTempId();
    const replyData = window.getReplyData?.();

    addMessageIfNotExists(
        text,
        true,
        new Date(),
        'sending',
        tempId,
        replyData ? {
            reply_to: replyData.messageId,
            reply_text: replyData.messageText,
            reply_sender: replyData.senderName
        } : {}
    );

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            updateMessageStatus(tempId, 'error');
            reject(new Error('Таймаут'));
        }, 10000);

        socket.emit('send_message', {
            message_text: text,
            reply_to_id: replyToId ? Number(replyToId) : null,
            chat_id: chatId
        }, (response) => {
            clearTimeout(timeout);

            if (response?.success) {
                updateMessageStatus(tempId, 'delivered');
                updateMessageId(tempId, response.message_id);
                resolve(response);
            } else {
                const errorMsg = response?.error || 'Ошибка сервера';
                updateMessageStatus(tempId, 'error');
                reject(new Error(errorMsg));
            }
        });
    });
}

export function sendUserActive() {
    if (window.socket?.connected && window.currentUser?.id) {
        window.socket.emit('user_active');
    }
}

export function sendTyping(chatId) {
    if (window.socket?.connected && chatId) {
        window.socket.emit('typing', { chat_id: chatId });
    }
}
