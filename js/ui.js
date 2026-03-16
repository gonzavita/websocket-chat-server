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

    // Контейнер сообщения
    const container = document.createElement('div');
    container.className = isMyMessage ? 'message-container sent' : 'message-container received';
    container.dataset.messageId = msg.id;

    // Аватарка (только для входящих)
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = msg.username?.charAt(0).toUpperCase() || 'U';

    // Само сообщение
    const message = document.createElement('div');
    message.className = isMyMessage ? 'message sent' : 'message received';
    message.textContent = msg.content;

    // Время + галочки
    const meta = document.createElement('div');
    meta.className = 'message-time';

    const time = new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.textContent = time;

    if (isMyMessage) {
        const checks = document.createElement('span');
        checks.className = 'checks sent'; // изначально "отправлено"
        checks.innerHTML = '<span class="check">✓</span>';
        meta.appendChild(checks);
    }

    message.appendChild(meta);

    // Правильная вставка: мои — справа, чужие — слева
    if (isMyMessage) {
        container.appendChild(message);
    } else {
        container.appendChild(avatar);
        container.appendChild(message);
    }

    messagesContainer.appendChild(container);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return container;
}

// Экспортируем глобально
window.addMessageLocally = addMessageToChat;

/**
 * Открывает чат
 */
export async function openChat(chatId, initialName = 'Чат') {
    currentChatId = chatId;
    window.currentChatId = chatId;

    const header = document.getElementById('chatHeader');
    const messages = document.getElementById('messages');
    if (messages) messages.innerHTML = '';

    // Подключаемся к WebSocket
    connectToChat(chatId, window.currentUser.id);

    // Загружаем историю сообщений
    await loadMessagesHistory(chatId);

    // Получаем данные собеседника
    try {
        const res = await fetch(`https://service-taxi31.ru/api/chat_participants.php?chat_id=${chatId}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (interlocutor) {
                if (header) header.textContent = interlocutor.username;
                const avatar = document.getElementById('currentAvatar');
                if (avatar) {
                    avatar.textContent = interlocutor.username.charAt(0).toUpperCase();
                }
            } else {
                if (header) header.textContent = initialName;
            }
        }
    } catch (err) {
        console.error('Ошибка при получении участников:', err);
        if (header) header.textContent = initialName;
    }

    // Обновляем статус собеседника
    updateInterlocutorStatus(chatId);
}

/**
 * Загрузка истории сообщений
 */

/**
 * Пометить все входящие как прочитанные
 */
async function markAllReceivedAsRead(chatId) {
    try {
        const res = await fetch(
            `https://service-taxi31.ru/api/messages.php?action=get&chat_id=${chatId}&last_id=0&limit=100`
        );
        const data = await res.json();

        if (data.messages && Array.isArray(data.messages)) {
            const received = data.messages.filter(m => m.sender_id != window.currentUser.id);
            for (const msg of received) {
                await markAsRead(msg.id, window.currentUser.id);
            }
        }
    } catch (err) {
        console.warn('Не удалось отметить прочитанные:', err);
    }
}

/**
 * Обновление статуса собеседника
 */
async function updateInterlocutorStatus(chatId) {
    try {
        const res = await fetch(`https://service-taxi31.ru/api/chat_participants.php?chat_id=${chatId}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (!interlocutor) return;

            const statusRes = await fetch(`https://service-taxi31.ru/api/user_status.php?user_id=${interlocutor.id}`);
            const statusData = await statusRes.json();

            const statusText = statusData.online ? '🟢 онлайн' : '⚪ оффлайн';
            const header = document.getElementById('chatHeader');
            const existing = document.getElementById('status');
            if (existing) existing.remove();
            if (header) {
                header.insertAdjacentHTML('afterend', `<small id="status">${statusText}</small>`);
            }
        }
    } catch (err) {
        console.error('Ошибка при проверке статуса:', err);
    }
}
