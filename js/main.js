// js/main.js
import { openChat } from './ui.js';
import '/js/search.js';

window.currentUser = null;
window.currentChatId = null;
window.currentMessageElement = null;

window.loadChats = async () => {
    try {
        const res = await fetch(`/api/chats?user_id=${window.currentUser.id}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.chats)) {
            const chatsList = document.getElementById('chatsList');
            chatsList.innerHTML = '';

            data.chats.forEach(chat => {
                const chatId = chat.chat_id || chat.id;
                const display_name = chat.display_name || 'Чат';
                const firstLetter = display_name.charAt(0).toUpperCase();
                const lastMessage = chat.last_message || 'Нет сообщений';

                const onlineDot = chat.online
                    ? '<div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>'
                    : '';

                const item = document.createElement('div');
                item.className = 'chat-item p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-3 border-b last:border-b-0 relative';
                item.dataset.chatId = chatId;

                item.innerHTML = `
                    <div class="chat-avatar w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-lg font-medium relative">
                        ${firstLetter}
                        ${onlineDot}
                    </div>
                    <div class="chat-info flex-1 min-w-0">
                        <div class="chat-name font-medium text-gray-800 dark:text-gray-100 truncate">${display_name}</div>
                        <div class="chat-preview text-sm text-gray-500 dark:text-gray-400 truncate">${lastMessage}</div>
                    </div>
                `;

                item.addEventListener('click', () => {
                    openChat(chatId, display_name);
                    if (window.innerWidth < 1024) {
                        sidebar.classList.add('-translate-x-full');
                        backBtn.style.display = 'block';
                    }
                });

                chatsList.appendChild(item);
            });
        }
    } catch (err) {
        console.error('Ошибка загрузки чатов:', err);
    }
};

// === КОНТЕКСТНОЕ МЕНЮ ===
const contextMenu = document.getElementById('contextMenu');

document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target) && !e.target.closest('.message-bubble')) {
        contextMenu.classList.add('hidden');
    }
});

document.addEventListener('contextmenu', (e) => {
    const bubble = e.target.closest('.message-bubble');
    if (!bubble || !bubble.dataset.mid) return;

    e.preventDefault();
    window.currentMessageElement = bubble;

    contextMenu.classList.remove('hidden');
    contextMenu.style.position = 'fixed';
    contextMenu.style.visibility = 'hidden';
    document.body.appendChild(contextMenu);

    const { width: menuWidth, height: menuHeight } = contextMenu.getBoundingClientRect();

    contextMenu.style.visibility = 'visible';
    contextMenu.classList.add('hidden');
    contextMenu.style.position = 'absolute';

    const x = e.clientX;
    const y = e.clientY;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let left = x;
    let top = y;

    if (x + menuWidth > winWidth) left = winWidth - menuWidth - 10;
    if (y + menuHeight > winHeight) top = winHeight - menuHeight - 10;
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.classList.remove('hidden');
});

// === ОСНОВНОЙ КОД ПРИЛОЖЕНИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            window.currentUser = JSON.parse(savedUser);
        } catch (e) {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
            return;
        }
    } else {
        window.location.href = 'index.html';
        return;
    }
    
    const chatApp = document.getElementById('chatApp');
    chatApp.style.display = 'block';
    window.loadChats();
    const lastChatId = localStorage.getItem('lastOpenedChat');
    if (lastChatId) {
        openChat(lastChatId);
    }
    const logoutBtn = document.getElementById('logout');
    const logoutFromProfile = document.getElementById('logoutFromProfile');
    const themeToggle = document.getElementById('themeToggle');
    const currentAvatar = document.getElementById('currentAvatar');
    const menuToggle = document.getElementById('menuToggle');
    const overlayLeft = document.getElementById('overlayLeft');
    const sidebar = document.getElementById('sidebar');
    const profilePanel = document.getElementById('profilePanel');
    const closeProfile = document.getElementById('closeProfile');
    const overlayRight = document.getElementById('overlayRight');
    const messageInput = document.getElementById('messageInput');
    const messageForm = document.getElementById('messageForm');
    const backBtn = document.getElementById('backBtn');

    chatApp.style.display = 'block';
    window.loadChats();

    backBtn?.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        window.currentChatId = null;
        document.getElementById('chatHeader').textContent = 'Выберите чат';
        document.getElementById('messages').innerHTML = '';
        document.getElementById('connection-status').textContent = 'оффлайн';
        backBtn.style.display = 'none';
    });

    [logoutBtn, logoutFromProfile].forEach(btn => {
        btn?.addEventListener('click', () => {
            if (window.statusInterval) clearInterval(window.statusInterval);
            if (window.readStatusInterval) clearInterval(window.readStatusInterval);
            window.currentUser = null;
            window.currentChatId = null;
            window.socket?.disconnect?.();
            chatApp.style.display = 'none';
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    });

    themeToggle?.addEventListener('change', () => {
        document.body.classList.toggle('dark', themeToggle.checked);
        localStorage.setItem('darkMode', themeToggle.checked);
    });

    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
        themeToggle.checked = true;
    }

    currentAvatar?.addEventListener('click', () => {
        profilePanel.classList.remove('translate-x-full');
        overlayRight.classList.remove('hidden');
    });

    closeProfile?.addEventListener('click', () => {
        profilePanel.classList.add('translate-x-full');
        overlayRight.classList.add('hidden');
    });

    overlayRight?.addEventListener('click', (e) => {
        if (e.target === overlayRight) closeProfile?.click();
    });

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        overlayLeft.classList.remove('hidden');
    });

    overlayLeft?.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        overlayLeft.classList.add('hidden');
    });

    function updateLayout() {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop) {
            sidebar.classList.remove('-translate-x-full');
            overlayLeft.classList.add('hidden');
            backBtn.style.display = 'none';
        } else {
            if (!window.currentChatId) {
                sidebar.classList.remove('-translate-x-full');
            }
            overlayLeft.classList.add('hidden');
            backBtn.style.display = 'none';
        }
    }

    updateLayout();
    window.addEventListener('resize', updateLayout);

    // === УМНЫЙ ТАЙМЕР АКТИВНОСТИ ===
    let activityTimer;

    function resetActivityTimer() {
        if (activityTimer) clearTimeout(activityTimer);
        import('./socket.js').then(m => m.sendUserActive());
        activityTimer = setTimeout(() => {
            console.log('🛑 Пользователь неактивен >5 сек');
        }, 5000);
    }

    ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'].forEach(event => {
        window.addEventListener(event, resetActivityTimer);
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) resetActivityTimer();
    });

    resetActivityTimer();

    function wakeUpServer() {
        fetch('/api/online').catch(() => {});
    }
    setInterval(wakeUpServer, 600000);
    wakeUpServer();

   // Автофокус и ресайз textarea + отправка "печатает"
let typingTimer; // Таймер для ограничения частоты отправки

messageInput?.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = `${Math.min(this.scrollHeight, 100)}px`;

    // Если есть открытый чат — отправляем сигнал "печатает"
    if (window.currentChatId) {
        // Импортируем функцию и отправляем событие
        import('./socket.js').then(m => m.sendTyping(window.currentChatId));
        
        // Ограничиваем отправку — не чаще раза в 2.5 секунды (анти-флуд)
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {}, 2500);
    }
});


function handleSendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    const chatId = window.currentChatId;
    if (!text || !chatId || !window.currentUser) return;

    const replyData = window.getReplyData?.();
    const replyToId = replyData 
        ? (String(replyData.messageId).startsWith('temp_') ? null : Number(replyData.messageId))
        : null;

    if (replyToId !== null && isNaN(replyToId)) {
        console.warn('⚠️ Некорректный reply_to_id, игнорируем:', replyData?.messageId);
    }

    import('./socket.js').then(async ({ sendMessage }) => {
        try {
            await sendMessage(text, chatId, replyToId);

            messageInput.value = '';
            messageInput.style.height = 'auto';
            window.cancelReply?.();

        } catch (err) {
            alert('Не удалось отправить сообщение');
            console.error('Ошибка отправки:', err);
            messageInput.value = text;
        }
    });
}


    // Отправка по Enter
    messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    });

    // Отправка по кнопке
    messageForm?.addEventListener('submit', handleSendMessage);

    // Фокусировка чата
    messageInput?.addEventListener('focus', () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const messages = document.getElementById('messages');
                messages.scrollTop = messages.scrollHeight;
            });
        });
    });
});
