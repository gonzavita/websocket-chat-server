// js/main.js
import { loadChats as loadChatsFunc } from './chats.js';
import { openChat } from './ui.js';
import '/js/search.js';

window.currentUser = null;
window.currentChatId = null;

window.loadChats = () => {
    if (window.currentUser && window.currentUser.id) {
        loadChatsFunc();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
    } else {
        window.location.href = 'index.html';
        return;
    }

    const chatApp = document.getElementById('chatApp');
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
    const sendBtn = document.getElementById('sendBtn');

    chatApp.style.display = 'flex';
    window.loadChats();
    startStatusUpdateViaSocket();

    [logoutBtn, logoutFromProfile].forEach(btn => {
        btn?.addEventListener('click', () => {
            if (window.statusInterval) clearInterval(window.statusInterval);
            window.currentUser = null;
            window.currentChatId = null;
            chatApp.style.display = 'none';
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
        profilePanel.classList.add('open');
        overlayRight.classList.add('active');
    });

    closeProfile?.addEventListener('click', () => {
        profilePanel.classList.remove('open');
        overlayRight.classList.remove('active');
    });

    overlayRight?.addEventListener('click', (e) => {
        if (e.target === overlayRight) closeProfile?.click();
    });

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.add('hidden');
        overlayLeft.classList.add('active');
    });

    overlayLeft?.addEventListener('click', () => {
        sidebar.classList.remove('hidden');
        overlayLeft.classList.remove('active');
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            sidebar.classList.remove('hidden');
            overlayLeft.classList.remove('active');
            profilePanel.classList.remove('open');
            overlayRight.classList.remove('active');
        }
    });

    sendBtn?.addEventListener('click', async () => {
        const text = messageInput.value.trim();
        if (!text || !window.currentChatId || !window.currentUser) return;

        messageInput.value = '';
        try {
            await import('./socket.js').then(m => m.sendMessage(text));
        } catch (err) {
            console.error('Send failed:', err);
            alert('Сообщение не отправлено. Проверьте соединение.');
            messageInput.value = text;
        }
    });

    messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBtn?.click();
    });
});

function startStatusUpdateViaSocket() {
    if (window.statusInterval) clearInterval(window.statusInterval);

    const interval = setInterval(() => {
        import('./socket.js').then(m => {
            if (m.getSocketState()?.connected && window.currentUser) {
                clearInterval(interval);
                window.statusInterval = setInterval(() => {
                    m.sendUserActive();
                }, 30000);
            }
        });
    }, 500);
}
