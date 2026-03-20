// js/ui.js
import { connectToChat } from './socket.js';

export let currentChatId = null;
let lastMarkedMessageId = null;
const participantsCache = {};

// Храним интервалы для очистки
if (!window.readStatusInterval) window.readStatusInterval = null;

export function setConnectionStatus() {
    const el = document.getElementById('connection-status');
    if (!el || !window.currentChatId) return;

    getParticipants(window.currentChatId).then(data => {
        if (data?.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (interlocutor) {
                fetch(`/api/online`)
                    .then(res => res.json())
                    .then(onlineData => {
                        const isOnline = Array.isArray(onlineData.online) &&
                            onlineData.online.includes(String(interlocutor.id));

                        if (isOnline) {
                            el.textContent = 'в сети';
                            el.className = 'text-xs px-2 py-1 rounded-full bg-green-500 text-white';
                        } else if (interlocutor.last_seen) {
                            el.textContent = formatLastSeen(interlocutor.last_seen);
                            el.className = 'text-xs px-2 py-1 rounded-full bg-gray-400 text-white';
                        } else {
                            el.textContent = 'оффлайн';
                            el.className = 'text-xs px-2 py-1 rounded-full bg-gray-400 text-white';
                        }
                    })
                    .catch(() => {
                        el.textContent = 'оффлайн';
                        el.className = 'text-xs px-2 py-1 rounded-full bg-gray-400 text-white';
                    });
            }
        }
    }).catch(() => {
        el.textContent = 'оффлайн';
        el.className = 'text-xs px-2 py-1 rounded-full bg-gray-400 text-white';
    });
}

function formatLastSeen(date) {
    const msgDate = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(msgDate.getTime())) return 'оффлайн';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const diffMs = now - msgDate;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    const timeStr = msgDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (diffSec < 10) return 'был только что';
    if (diffMin < 5) return 'был недавно';
    if (diffMin < 60) return `был ${diffMin} мин назад`;
    if (diffHour < 6 && msgDate >= today) return `был сегодня в ${timeStr}`;
    if (msgDate >= today) return `был сегодня в ${timeStr}`;
    if (msgDate >= yesterday) return `был вчера в ${timeStr}`;

    return `был ${msgDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${timeStr}`;
}

export function updateMessageStatus(messageId, status) {
    const id = String(messageId);

    const wrapper = document.querySelector(`[data-mid="${id}"]`);
    if (!wrapper) {
        console.warn('❌ Не найден элемент для messageId:', id);
        return;
    }

    const icon = wrapper.querySelector('.status-icon');
    if (icon) {
        icon.textContent = status === 'read' ? '✓✓' : '✓';
        //console.log('✅ Статус обновлён:', icon.textContent);
    } else {
        console.warn('❌ Нет .status-icon в элементе:', wrapper);
    }
}

export function updateMessageId(oldId, newId) {
    const bubble = document.querySelector(`[data-mid="${String(oldId)}"]`);
    if (!bubble) return;
    bubble.dataset.mid = String(newId);
}

export function addMessageIfNotExists(content, isSent, timestamp, status = 'sent', messageId = null, options = {}) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const { reply_to = null, reply_text = '', reply_sender = '' } = options;

    if (messageId && messagesContainer.querySelector(`[data-mid="${String(messageId)}"]`)) {
        return;
    }

    const now = timestamp instanceof Date ? timestamp : new Date();
    const timeStr = new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(now);

    const wrapper = document.createElement('div');
    wrapper.dataset.mid = String(messageId || '');
    wrapper.className = isSent
        ? 'mb-4 max-w-[80%] self-end message-bubble'
        : 'flex items-end gap-2 mb-4 max-w-[80%] self-start message-bubble';

    const messageDiv = document.createElement('div');
    messageDiv.className = isSent
        ? 'bg-blue-500 text-white rounded-lg rounded-tr-none px-4 py-2 text-sm leading-relaxed break-words'
        : 'bg-gray-100 dark:bg-gray-700 rounded-lg rounded-tl-none px-4 py-2 text-gray-800 dark:text-gray-100 text-sm leading-relaxed break-words';

    // === Цитата (если есть) ===
    if (reply_to) {
        const replyEl = document.createElement('div');
        replyEl.className = 'flex items-start gap-2 text-xs italic opacity-90 mb-1 pl-2 border-l-2 border-blue-400';
        replyEl.innerHTML = `
            <span>↩️</span>
            <div class="flex-1">
                <div class="font-medium">${reply_sender}</div>
                <div class="truncate">${reply_text}</div>
            </div>
        `;
        messageDiv.appendChild(replyEl);
    }

    // === Основной текст ===
    const contentLine = document.createElement('div');
    contentLine.className = 'flex items-end justify-between min-h-[1.5em]';

    const textSpan = document.createElement('span');
    textSpan.className = 'block max-w-full break-words';
    textSpan.textContent = content;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'text-xs ml-1 whitespace-nowrap flex items-center';

    if (isSent) {
        const statusIcon = document.createElement('span');
        statusIcon.className = 'status-icon';
        statusIcon.textContent = status === 'read' ? '✓✓' : '✓';
        metaSpan.appendChild(statusIcon);
    }

    const timeSpan = document.createElement('span');
    timeSpan.textContent = ` ${timeStr}`;
    metaSpan.appendChild(timeSpan);

    contentLine.appendChild(textSpan);
    contentLine.appendChild(metaSpan);
    messageDiv.appendChild(contentLine);

    // === Аватар для входящих ===
    if (!isSent) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium';
        const name = document.getElementById('chatHeader')?.textContent || 'С';
        avatarDiv.textContent = name.charAt(0).toUpperCase();
        wrapper.appendChild(avatarDiv);
    }

    wrapper.appendChild(messageDiv);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


function formatDateHeader(date) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgStr = date.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (msgStr === todayStr) return 'Сегодня';
    if (msgStr === yesterdayStr) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export async function openChat(chatId, initialName = 'Чат') {
    if (!chatId) {
        console.warn('❌ openChat: chatId не указан');
        return;
    }

    // Очищаем предыдущие интервалы
    if (window.readStatusInterval) {
        clearInterval(window.readStatusInterval);
        window.readStatusInterval = null;
    }

    if (currentChatId === chatId) return;

    currentChatId = chatId;
    window.currentChatId = chatId;

    const header = document.getElementById('chatHeader');
    const messages = document.getElementById('messages');
    if (messages) messages.innerHTML = '';

    connectToChat(chatId, window.currentUser.id);

    try {
        const res = await fetch(`/api/messages/get?chat_id=${chatId}`);
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

            // Обновляем статусы прочтения отправленных сообщений
            const sentIds = result.messages
                .filter(m => m.sender_id == window.currentUser.id)
                .map(m => m.id);

            if (sentIds.length > 0) {
                const statuses = await getReadStatus(chatId, sentIds);
                Object.entries(statuses).forEach(([msgId, status]) => {
                    updateMessageStatus(parseInt(msgId), status);
                });
            }
        }
    } catch (err) {
        console.error('Ошибка загрузки истории:', err);
    }

    try {
        const data = await getParticipants(chatId);
        if (data?.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (interlocutor) {
                if (header) header.textContent = interlocutor.username;
                const avatar = document.getElementById('currentAvatar');
                if (avatar) {
                    avatar.textContent = interlocutor.username.charAt(0).toUpperCase();
                }
            } else if (header) {
                header.textContent = initialName;
            }
        }
    } catch (err) {
        console.error('Ошибка участников:', err);
        if (header) header.textContent = initialName;
    }

    // Принудительно проверяем прочитанные и обновляем свои статусы
    setTimeout(async () => {
        await markAllReceivedAsRead(chatId);

        // 🔁 Принудительно обновляем статусы своих сообщений
        const sentMessages = messages.querySelectorAll('.self-end[data-mid]');
        const sentIds = Array.from(sentMessages).map(el => parseInt(el.dataset.mid)).filter(id => !isNaN(id));
        if (sentIds.length > 0) {
            const statuses = await getReadStatus(chatId, sentIds);
            Object.entries(statuses).forEach(([msgId, status]) => {
                updateMessageStatus(parseInt(msgId), status);
            });
        }

        messages.scrollTop = messages.scrollHeight;
    }, 500);
    // После openChat
    window.addEventListener('focus', () => {
        if (window.currentChatId) {
            markAllReceivedAsRead(window.currentChatId);
        }
    });

    // Запускаем периодическое обновление статусов (каждые 3 сек)
    window.readStatusInterval = setInterval(async () => {
        const sentMessages = messages.querySelectorAll('.self-end[data-mid]');
        const sentIds = Array.from(sentMessages).map(el => parseInt(el.dataset.mid)).filter(id => !isNaN(id));
        if (sentIds.length > 0) {
            const statuses = await getReadStatus(chatId, sentIds);
            Object.entries(statuses).forEach(([msgId, status]) => {
                updateMessageStatus(parseInt(msgId), status);
            });
        }
    }, 3000);

    if (window.statusInterval) clearInterval(window.statusInterval);
    setConnectionStatus();

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.focus();
    }
}

async function getParticipants(chatId) {
    if (participantsCache[chatId]) {
        const age = Date.now() - participantsCache[chatId].timestamp;
        if (age < 5000) return participantsCache[chatId].data;
    }

    try {
        const res = await fetch(`/api/chat_participants?chat_id=${chatId}`);
        const data = await res.json();
        if (data.success) {
            participantsCache[chatId] = { data, timestamp: Date.now() };
            return data;
        }
    } catch (err) {
        console.error('Ошибка получения участников:', err);
    }
    return null;
}

let readTimeout;

export async function markManyAsRead(messageIds, userId) {
    if (!Array.isArray(messageIds) || messageIds.length === 0 || !userId) return;

    clearTimeout(readTimeout);
    readTimeout = setTimeout(async () => {
        try {
            await fetch('/api/messages/batch_read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_ids: messageIds, user_id: userId })
            });
        } catch (err) {
            console.warn('Ошибка массового прочтения:', err);
        }
    }, 100);
}

export async function markAllReceivedAsRead(chatId) {
    if (!window.currentUser || !chatId) return;

    try {
        const res = await fetch(`/api/messages/get?chat_id=${chatId}&limit=100`);
        const data = await res.json();

        if (!data.messages || !Array.isArray(data.messages)) return;

        const received = data.messages
            .filter(m => m.sender_id != window.currentUser.id && !m.read) // ← можно добавить флаг read
            .map(m => m.id);

        if (received.length === 0) return;

        const maxId = Math.max(...received);
        // Убрали: if (lastMarkedMessageId === maxId) return;

        lastMarkedMessageId = maxId; // всё равно обновляем

        await markManyAsRead([maxId], window.currentUser.id);

        // Обновляем статусы своих сообщений
        const sentIds = data.messages
            .filter(m => m.sender_id == window.currentUser.id)
            .map(m => m.id);

        if (sentIds.length > 0) {
            const statuses = await getReadStatus(chatId, sentIds);
            Object.entries(statuses).forEach(([msgId, status]) => {
                updateMessageStatus(parseInt(msgId), status);
            });
        }
    } catch (err) {
        console.warn('Ошибка отметки прочтения:', err);
    }
}


export async function getReadStatus(chatId, messageIds) {
    try {
        const res = await fetch(
    `/api/messages/read_status?chat_id=${chatId}&message_ids=${messageIds.join(',')}&user_id=${window.currentUser.id}&t=${Date.now()}`
);

        const data = await res.json();
        const readBy = data.read_by || {};

        // Получаем ID собеседника
        let interlocutorId = null;
        if (!interlocutorId) {
            try {
                const partRes = await fetch(`/api/chat_participants?chat_id=${chatId}`);
                const partData = await partRes.json();
                const interlocutor = partData.users?.find(u => u.id !== window.currentUser.id);
                interlocutorId = interlocutor?.id || null;
            } catch (err) {
                console.warn('Не удалось получить участников');
            }
        }

        const statuses = {};
        for (const msgId of messageIds) {
            const readers = readBy[msgId] || [];
            // Теперь: прочитано, если собеседник в списке
            const hasOtherUserRead = interlocutorId && readers.includes(Number(interlocutorId));
            statuses[msgId] = hasOtherUserRead ? 'read' : 'delivered';
        }
        return statuses;
    } catch (err) {
        console.error('Ошибка статуса:', err);
        return {};
    }
}

