// js/ui.js
import { connectToChat } from './socket.js';

export let currentChatId = null;

export function setConnectionStatus(status) {
    const el = document.getElementById('connection-status');
    if (el) {
        el.textContent = status;
        el.className = 'status-indicator ' + (status === 'онлайн' ? 'online' : 'offline');
    }
}

export function updateMessageStatus(messageId, status) {
    const bubble = document.querySelector(`[data-mid="${messageId}"]`);
    if (!bubble) return;
    const isSent = bubble.classList.contains('is-out');
    if (!isSent) return;

    bubble.classList.remove('delivered', 'read');
    bubble.classList.add(status);
}

export function addMessageIfNotExists(content, isMine, time, status, id) {
    if (document.querySelector(`[data-mid="${id}"]`)) {
        console.log('💬 Сообщение уже есть, пропускаем:', id);
        return;
    }
    if (window.giga_addMessage) {
        window.giga_addMessage(content, isMine, time, status, id);
    }
}

export async function openChat(chatId, initialName = 'Чат') {
    console.log('🔧 [ui] Открываем чат:', chatId);
    currentChatId = chatId;
    window.currentChatId = chatId;

    const header = document.getElementById('chatHeader');
    const messages = document.getElementById('messages');
    if (messages) messages.innerHTML = '';

    connectToChat(chatId, window.currentUser.id);

    try {
        const res = await fetch(
            `https://websocket-chat-server-lm97.onrender.com/api/messages?chat_id=${chatId}`
        );
        const result = await res.json();

        if (result.messages && Array.isArray(result.messages)) {
            result.messages.forEach(msg => {
                const isSent = String(msg.sender_id) === String(window.currentUser.id);
                addMessageIfNotExists(
                    msg.content,
                    isSent,
                    new Date(msg.sent_at),
                    'delivered',
                    msg.id
                );
            });

            const sentIds = result.messages
                .filter(m => m.sender_id == window.currentUser.id)
                .map(m => m.id);

            if (sentIds.length > 0) {
                getReadStatus(chatId, sentIds).then(statuses => {
                    Object.entries(statuses).forEach(([msgId, status]) => {
                        updateMessageStatus(parseInt(msgId), status);
                    });
                });
            }
        }
    } catch (err) {
        console.error('Ошибка загрузки истории:', err);
    }

    try {
        const res = await fetch(`https://websocket-chat-server-lm97.onrender.com/api/chat_participants?chat_id=${chatId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (interlocutor) {
                if (header) header.textContent = interlocutor.username;
                const avatar = document.getElementById('currentAvatar');
                if (avatar) avatar.textContent = interlocutor.username.charAt(0).toUpperCase();
            } else if (header) {
                header.textContent = initialName;
            }
        }
    } catch (err) {
        console.error('Ошибка участников:', err);
        if (header) header.textContent = initialName;
    }

    setTimeout(() => markAllReceivedAsRead(chatId), 500);

    messages?.addEventListener('scroll', () => {
        if (messages.scrollTop + messages.clientHeight >= messages.scrollHeight - 10) {
            markAllReceivedAsRead(chatId);
        }
    });
}

async function markAllReceivedAsRead(chatId) {
    if (!window.currentUser) return;
    try {
        const res = await fetch(
            `https://websocket-chat-server-lm97.onrender.com/api/messages?chat_id=${chatId}`
        );
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
            const received = data.messages
                .filter(m => m.sender_id != window.currentUser.id)
                .map(m => m.id);

            if (received.length > 0) {
                markManyAsRead(received, window.currentUser.id);
            }
        }
    } catch (err) {
        console.warn('Не удалось отметить прочитанные:', err);
    }
}


async function getReadStatus(chatId, messageIds) {
    try {
        const res = await fetch(
            `https://websocket-chat-server-lm97.onrender.com/api/messages?action=read_status&chat_id=${chatId}&message_ids=${messageIds.join(',')}&user_id=${window.currentUser.id}`
        );
        const data = await res.json();
        const readBy = data.read_by || {};
        const statuses = {};
        for (const msgId of messageIds) {
            const readers = readBy[msgId] || [];
            const hasOtherUserRead = readers.length > 0 && !readers.includes(window.currentUser.id);
            statuses[msgId] = hasOtherUserRead ? 'read' : 'delivered';
        }
        return statuses;
    } catch (err) {
        console.error('Ошибка статуса:', err);
        return {};
    }
}

export async function markManyAsRead(messageIds, userId) {
    if (!Array.isArray(messageIds) || messageIds.length === 0 || !userId) return;
    try {
        await fetch('https://websocket-chat-server-lm97.onrender.com/api/messages/batch_read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_ids: messageIds, user_id: userId })
        });
    } catch (err) {
        console.warn('Ошибка массового прочтения:', err);
    }
}
