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
 * Пометить все входящие как прочитанные
 */
async function markAllReceivedAsRead(chatId) {
    try {
        const res = await fetch(
            `https://service-taxi31.ru/api/messages.php?action=get&chat_id=${chatId}&last_id=0&limit=100`
        );
        let data;
            try {
                const text = await res.text();
                if (!text) {
                    console.error('Пустой ответ от сервера');
                    return;
                }
                data = JSON.parse(text);
            } catch (err) {
                console.error('Не JSON:', err, 'Ответ:', text);
                return;
            }


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

    // Получаем данные собеседника
    try {
        const res = await fetch(`https://service-taxi31.ru/api/chat_participants.php?chat_id=${chatId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (interlocutor) {
                if (header) header.textContent = interlocutor.username;
                const avatar = document.getElementById('currentAvatar');
                if (avatar) avatar.textContent = interlocutor.username.charAt(0).toUpperCase();

                // Показываем статус собеседника
                updateInterlocutorStatus(interlocutor.id);
            } else if (header) {
                header.textContent = initialName;
            }
        }
    } catch (err) {
        console.error('Ошибка участников:', err);
        if (header) header.textContent = initialName;
    }

    // Помечаем как прочитанные при открытии и прокрутке
    setTimeout(() => markAllReceivedAsRead(chatId), 500);

    messages?.addEventListener('scroll', () => {
        if (messages.scrollTop + messages.clientHeight >= messages.scrollHeight - 10) {
            markAllReceivedAsRead(chatId);
        }
    });
}

/**
 * Обновляет онлайн-статус собеседника
 */
async function updateInterlocutorStatus(userId) {
    try {
        const res = await fetch(`https://service-taxi31.ru/api/user_status.php?user_id=${userId}`);
        
        let data;
        try {
            const text = await res.text();
            if (!text.trim()) {
                console.error('Пустой ответ от user_status.php');
                return;
            }
            data = JSON.parse(text);
        } catch (err) {
            console.error('JSON parse error:', err);
            return;
        }

        const statusEl = document.getElementById('interlocutorStatus');
        if (!statusEl) return;

        let statusText = '';

        if (data.online) {
            statusText = '🟢 онлайн';
        } else if (data.last_seen) {
            const time = new Date(data.last_seen);
            const hours = time.getHours().toString().padStart(2, '0');
            const minutes = time.getMinutes().toString().padStart(2, '0');
            statusText = `⚪ был в сети ${hours}:${minutes}`;
        } else {
            statusText = '⚪ оффлайн';
        }

        statusEl.textContent = statusText;
    } catch (err) {
        console.error('Ошибка загрузки статуса:', err);
    }
}



/**
 * Обновляет список чатов с онлайн-статусами
 */
export async function updateChatsListWithStatus() {
    const chatItems = document.querySelectorAll('.chat-item');
    for (const item of chatItems) {
        const chatId = item.dataset.chatId;
        if (!chatId) continue;

        try {
            const res = await fetch(`https://service-taxi31.ru/api/chat_participants.php?chat_id=${chatId}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.users)) {
                const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
                if (interlocutor) {
                    const statusRes = await fetch(`https://service-taxi31.ru/api/user_status.php?user_id=${interlocutor.id}`);
                    const statusData = await statusRes.json();
                    const statusText = statusData.online 
    ? '🟢'
    : `⚪ ${formatTimeShort(statusData.last_seen)}`;

function formatTimeShort(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


                    // Ищем или создаём элемент статуса
                    let statusSpan = item.querySelector('.chat-status');
                    if (!statusSpan) {
                        statusSpan = document.createElement('small');
                        statusSpan.className = 'chat-status';
                        statusSpan.style.marginLeft = '6px';
                        item.querySelector('.chat-name')?.appendChild(statusSpan);
                    }
                    statusSpan.textContent = ` ${statusText}`;
                }
            }
        } catch (err) {
            console.warn('Не удалось обновить статус чата:', err);
        }
    }
}

// Обновляем статусы каждые 10 секунд
setInterval(() => {
    if (window.currentUser) {
        updateChatsListWithStatus();
    }
}, 10000);
