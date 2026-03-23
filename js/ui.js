// js/ui.js — С ЛОГИРОВАНИЕМ для диагностики
import { connectToChat, getParticipants, getReadStatus, markAllReceivedAsRead } from './socket.js';

export let currentChatId = null;
let lastMarkedMessageId = null;
const participantsCache = {};
let tempMessageCounter = 0;

export const knownReadStatus = new Set();
const seenMessageIds = new Set();

console.log('📊 [UI] Модуль ui.js загружен');

export function generateTempId() {
    return `temp_${Date.now()}_${++tempMessageCounter}`;
}

if (!window.readStatusInterval) window.readStatusInterval = null;

export function setConnectionStatus() {
    const el = document.getElementById('connection-status');
    if (!el || !window.currentChatId) {
        console.log('📍 setConnectionStatus: элемент статуса не найден или нет чата');
        return;
    }

    console.log('📍 setConnectionStatus: обновляем статус для чата', window.currentChatId);
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
        console.log('🔄 updateMessageStatus: элемент не найден (возможно, ещё не добавлен)', id);
        return;
    }

    const icon = wrapper.querySelector('.status-icon');
    if (icon) {
        icon.textContent = status === 'read' ? '✓✓' : '✓';
    }

    if (status === 'read') {
        knownReadStatus.add(id);
    }
}

export function updateMessageId(oldId, newId) {
    const bubble = document.querySelector(`[data-mid="${String(oldId)}"]`);
    if (!bubble) {
        console.warn('⚠️ Не найдено сообщение для обновления ID:', oldId);
        return;
    }
    bubble.dataset.mid = String(newId);
    console.log('🔁 ID сообщения обновлён:', oldId, '→', newId);
}

// Добавляет сообщение: prepend = true → в начало, false → в конец
export function addMessageIfNotExists(content, isSent, timestamp, status = 'sent', messageId = null, options = {}, prepend = false) {
    const messagesContainer = document.getElementById('messages');
    const id = messageId !== null ? String(messageId) : null;

    if (id && seenMessageIds.has(id)) {
        return;
    }

    if (id) {
        seenMessageIds.add(id);
    }

    // Создание typing-indicator при необходимости
    if (!document.getElementById('typing-indicator')) {
        const typingEl = document.createElement('div');
        typingEl.id = 'typing-indicator';
        typingEl.className = 'text-xs text-gray-500 italic px-4 py-1 hidden';
        messagesContainer.parentElement.insertBefore(typingEl, messagesContainer.nextSibling);
    }

    const { reply_to = null, reply_text = '', reply_sender = '' } = options;
    const now = timestamp instanceof Date ? timestamp : new Date();
    const timeStr = new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(now);

    const wrapper = document.createElement('div');
    wrapper.dataset.mid = id || '';
    wrapper.className = isSent
        ? 'mb-4 max-w-[80%] self-end message-bubble'
        : 'flex items-end gap-2 mb-4 max-w-[80%] self-start message-bubble';

    if (!isSent) {
        wrapper.setAttribute('data-sent', 'false');
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = isSent
        ? 'bg-blue-500 text-white rounded-lg rounded-tr-none px-4 py-2 text-sm leading-relaxed break-words'
        : 'bg-gray-100 dark:bg-gray-700 rounded-lg rounded-tl-none px-4 py-2 text-gray-800 dark:text-gray-100 text-sm leading-relaxed break-words';

    if (reply_to) {
        const replyEl = document.createElement('div');
        replyEl.className = 'flex items-start gap-2 text-xs italic opacity-90 mb-1 pl-2 border-l-2 border-blue-500 cursor-pointer hover:opacity-100 transition-opacity';

        const senderName = reply_sender || 'Собеседник';
        let text = reply_text;

        if (!text) {
            replyEl.classList.add('opacity-50');
            text = '[сообщение удалено]';
        }

        replyEl.innerHTML = `
            <span>↩️</span>
            <div class="flex-1">
                <div class="font-medium">${senderName}</div>
                <div class="truncate">${text}</div>
            </div>
        `;

        replyEl.addEventListener('click', () => {
            const target = messagesContainer.querySelector(`[data-mid="${String(reply_to)}"]`);
            if (target) {
                target.style.transition = 'background-color 0.3s ease';
                target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                setTimeout(() => target.style.backgroundColor = '', 1000);
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        messageDiv.appendChild(replyEl);
    }

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

    if (!isSent) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium';
        const name = document.getElementById('chatHeader')?.textContent || 'С';
        avatarDiv.textContent = name.charAt(0).toUpperCase();
        wrapper.appendChild(avatarDiv);
    }

    wrapper.appendChild(messageDiv);

    // Вставка: в начало или в конец
    if (prepend) {
        messagesContainer.insertBefore(wrapper, messagesContainer.firstChild);
    } else {
        messagesContainer.appendChild(wrapper);
    }

    // Прокрутка только если это НЕ prepend
    if (!prepend) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

export async function openChat(chatId, initialName = 'Чат') {
    console.log('🔧 openChat вызван', { chatId, currentChatId, opening: window.openingChat });

    if (!chatId) {
        console.error('❌ openChat: chatId не указан');
        return;
    }

    if (currentChatId === chatId) {
        console.log('🚫 Чат уже открыт:', chatId);
        return;
    }

    if (window.openingChat === chatId) {
        console.log('🟡 Открытие уже в процессе:', chatId);
        return;
    }

    window.openingChat = chatId;
    localStorage.setItem('lastOpenedChat', chatId);

    if (window.readStatusInterval) {
        clearInterval(window.readStatusInterval);
        window.readStatusInterval = null;
        console.log('🧹 Очищен интервал readStatusInterval');
    }

    knownReadStatus.clear();
    seenMessageIds.clear();
    console.log('🧹 Очищены кэши knownReadStatus и seenMessageIds');

    currentChatId = chatId;
    window.currentChatId = chatId;

    const header = document.getElementById('chatHeader');
    const messages = document.getElementById('messages');

    if (messages) {
        console.log('🗑️ Очистка контейнера сообщений');
        messages.innerHTML = '';
    }

    let typingEl = document.getElementById('typing-indicator');
    if (!typingEl) {
        typingEl = document.createElement('div');
        typingEl.id = 'typing-indicator';
        typingEl.className = 'text-xs text-gray-500 italic px-4 py-1 hidden';
        messages.parentElement.insertBefore(typingEl, messages.nextSibling);
    } else {
        typingEl.classList.add('hidden');
    }

    // --- Переменные для пагинации ---
    let messageOffset = 0;
    let hasMoreMessages = true;
    let loadingMore = false;

    function showLoadingTop(show) {
        let loader = document.getElementById('scroll-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'scroll-loader';
            loader.className = 'text-center text-gray-500 text-xs py-2';
            loader.textContent = 'Загрузка...';
            messages.prepend(loader);
        }
        loader.style.display = show ? 'block' : 'none';
    }

    async function loadMoreMessages() {
        if (loadingMore || !hasMoreMessages) return;
        loadingMore = true;
        showLoadingTop(true);

        try {
            const res = await fetch(`/api/messages/get?chat_id=${chatId}&limit=50&offset=${messageOffset}`);
            const result = await res.json();

            if (result.messages && Array.isArray(result.messages) && result.messages.length > 0) {
                const prevScrollHeight = messages.scrollHeight;

                // Добавляем старые сообщения ВНАЧАЛЕ (prepend = true)
                result.messages.forEach(msg => {
                    const isSent = String(msg.sender_id) === String(window.currentUser.id);
                    addMessageIfNotExists(
                        msg.content,
                        isSent,
                        new Date(msg.sent_at),
                        'delivered',
                        msg.id,
                        {
                            reply_to: msg.reply_to || null,
                            reply_text: msg.reply_text || '',
                            reply_sender: msg.reply_sender || ''
                        },
                        true // ← prepend: вставить в начало
                    );
                });

                messageOffset += result.messages.length;
                if (result.messages.length < 50) hasMoreMessages = false;

                // Сохраняем позицию прокрутки
                requestAnimationFrame(() => {
                    messages.scrollTop = messages.scrollHeight - prevScrollHeight;
                });
            } else {
                hasMoreMessages = false;
            }
        } catch (err) {
            console.error('❌ Ошибка подгрузки истории:', err);
        } finally {
            loadingMore = false;
            showLoadingTop(false);
        }
    }

    // Слушаем прокрутку вверх
    messages.addEventListener('scroll', () => {
        if (messages.scrollTop <= 10 && hasMoreMessages && !loadingMore) {
            loadMoreMessages();
        }
    });

    // Подключаемся к Socket.IO
    connectToChat(chatId, window.currentUser.id);

    try {
        console.log('📡 Запрос истории сообщений для чата', chatId);
        const res = await fetch(`/api/messages/get?chat_id=${chatId}&limit=50`);
        const result = await res.json();

        if (result.messages && Array.isArray(result.messages)) {
    console.log('✅ История получена, количество:', result.messages.length);

    // 🔹 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: reverse()
    [...result.messages].reverse().forEach(msg => {
        const isSent = String(msg.sender_id) === String(window.currentUser.id);
        addMessageIfNotExists(
            msg.content,
            isSent,
            new Date(msg.sent_at),
            'delivered',
            msg.id,
            {
                reply_to: msg.reply_to || null,
                reply_text: msg.reply_text || '',
                reply_sender: msg.reply_sender || ''
            },
            false
        );
    });

    messageOffset = result.messages.length;
    hasMoreMessages = result.messages.length >= 50;

            // Обновление статусов прочтения
            const sentIds = result.messages
                .filter(m => m.sender_id == window.currentUser.id)
                .map(m => m.id);

            if (sentIds.length > 0) {
                console.log('🔍 Запрос статусов прочтения для:', sentIds);
                const statuses = await getReadStatus(chatId, sentIds);
                Object.entries(statuses).forEach(([msgId, status]) => {
                    updateMessageStatus(parseInt(msgId), status);
                });
            }
        } else {
            console.warn('⚠️ Нет сообщений в истории');
            hasMoreMessages = false;
        }
    } catch (err) {
        console.error('❌ Ошибка загрузки истории:', err);
        hasMoreMessages = false;
    }

    // Обновление участников
    try {
        const data = await getParticipants(chatId);
        if (data?.success && Array.isArray(data.users)) {
            const interlocutor = data.users.find(u => u.id !== window.currentUser.id);
            if (interlocutor) {
                window.interlocutorId = interlocutor.id;
                if (header) header.textContent = interlocutor.username;
                const avatar = document.getElementById('currentAvatar');
                if (avatar) avatar.textContent = interlocutor.username.charAt(0).toUpperCase();
            } else if (header) {
                header.textContent = initialName;
            }
        }
    } catch (err) {
        console.error('❌ Ошибка участников:', err);
        if (header) header.textContent = initialName;
    }

    // Отметка прочитанных
    setTimeout(async () => {
        await markAllReceivedAsRead(chatId);
        console.log('📌 Отметка всех полученных как прочитанных');

        const sentMessages = messages.querySelectorAll('.self-end[data-mid]');
        const sentIds = Array.from(sentMessages)
            .map(el => parseInt(el.dataset.mid))
            .filter(id => !isNaN(id))
            .slice(-50);

        if (sentIds.length > 0) {
            const statuses = await getReadStatus(chatId, sentIds);
            Object.entries(statuses).forEach(([msgId, status]) => {
                updateMessageStatus(parseInt(msgId), status);
            });
        }

        messages.scrollTop = messages.scrollHeight;
    }, 500);

    // Фокус окна
    window.addEventListener('focus', () => {
        if (window.currentChatId) {
            markAllReceivedAsRead(window.currentChatId);
        }
    });

    // Периодическая проверка статусов
    window.readStatusInterval = setInterval(async () => {
        const sentMessages = messages.querySelectorAll('.self-end[data-mid]');
        const sentIds = Array.from(sentMessages)
            .map(el => parseInt(el.dataset.mid))
            .filter(id => !isNaN(id))
            .slice(-50);

        if (sentIds.length > 0) {
            const statuses = await getReadStatus(chatId, sentIds);
            Object.entries(statuses).forEach(([msgId, status]) => {
                updateMessageStatus(parseInt(msgId), status);
            });
        }
    }, 3000);

    // Обновление статуса "в сети"
    if (window.statusInterval) clearInterval(window.statusInterval);
    setConnectionStatus();

    // Фокус на инпут
    const messageInput = document.getElementById('messageInput');
    if (messageInput) messageInput.focus();

    console.log('✅ Чат успешно открыт:', chatId);
    window.openingChat = null;
}
