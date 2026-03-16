// js/ui.js
import { loadMessagesHistory, markAsRead } from './messages.js';
import { connectToChat } from './socket.js';

export let currentChatId = null;

/**
 * Добавляет сообщение в интерфейс
 */
export function addMessageToChat(msg) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const isMyMessage = msg.sender_id == window.currentUser.id;

    const container = document.createElement('div');
    container.className = isMyMessage ? 'message-container sent' : 'message-container received';
    container.dataset.messageId = msg.id;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = msg.username?.charAt(0).toUpperCase() || 'U';

    const message = document.createElement('div');
    message.className = isMyMessage ? 'message sent' : 'message received';
    message.textContent = msg.content;

    const meta = document.createElement('div');
    meta.className = 'message-time';

    const time = new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.textContent = time;

    if (isMyMessage) {
        const checks = document.createElement('span');
        checks.className = 'checks sent';
        checks.dataset.status = 'sent';
        checks.innerHTML = '<span class="check">✓</span><span class="check">✓</span>';
        meta.appendChild(checks);
    }

    message.appendChild(meta);

    if (isMyMessage) {
        container.appendChild(message);
    } else {
        container.appendChild(avatar);
        container.appendChild(message);
    }

    messagesContainer.appendChild(container);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    container.checksElement = meta.querySelector('.checks') || null;
    return container;
}

window.addMessageLocally = addMessageToChat;

/**
 * Обновляет статус прочтения
 */
export function updateMessageStatus(messageId, status) {
    const container = document.querySelector(`[data-message-id="${messageId}"]`);
    const checks = container?.checksElement;
    if (!checks) return;
    checks.dataset.status = status;
    if (status === 'delivered') checks.classList.add('delivered');
    else if (status === 'read') checks.classList.add('read');
}

/**
 * Открывает чат
 */
export async function openChat(chatId, initialName = 'Чат') {
    currentChatId = chatId;
    window.currentChatId = chatId;

    const header = document.getElementById('chatHeader');
    const messages = document.getElementById('messages');
    if (messages) messages.innerHTML = '';

    connectToChat(chatId, window.currentUser.id);
    await loadMessagesHistory(chatId);

    try {
        const res = await fetch(`https://service-taxi31.ru/api/chat_participants.php?chat_id=${chatId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (interlocutor) {
                if (header) header.textContent = interlocutor.username;
                const avatar = document.getElementById('currentAvatar');
                if (avatar) avatar.textContent = interlocutor.username.charAt(0).toUpperCase();
            } else if (header) header.textContent = initialName;
        }
    } catch (err) {
        console.error('Ошибка участников:', err);
        if (header) header.textContent = initialName;
    }

    messages?.addEventListener('scroll', () => {
        if (messages.scrollTop + messages.clientHeight >= messages.scrollHeight - 10) {
            markAllReceivedAsRead(chatId);
        }
    });

    setTimeout(() => markAllReceivedAsRead(chatId), 500);
}
