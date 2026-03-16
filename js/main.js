// js/main.js
import { loadChats as loadChatsFunc } from './chats.js';
import { openChat } from './ui.js';
import { sendMessage as sendSocketMessage } from './socket.js';

// Глобальные переменные
window.currentUser = null;
window.currentChatId = null;

// Загрузка списка чатов
window.loadChats = () => {
    if (window.currentUser && window.currentUser.id) {
        loadChatsFunc();
    }
};

// Переопределяем отправку сообщения через WebSocket
window.sendMessage = async function(text, chatId, userId) {
    return sendSocketMessage(text);
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен — старт');

    // === Элементы интерфейса ===
    const authScreen = document.getElementById('authScreen');
    const chatApp = document.getElementById('chatApp');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const toRegister = document.getElementById('toRegister');
    const toLogin = document.getElementById('toLogin');
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

    // === Проверка авторизации при старте ===
    if (localStorage.getItem('currentUser')) {
        window.currentUser = JSON.parse(localStorage.getItem('currentUser'));
        authScreen.style.display = 'none';
        chatApp.style.display = 'flex';
        window.loadChats();
    }

    // === Переключение между формами ===
    toRegister?.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    toLogin?.addEventListener('click', () => {
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // === Форма входа ===
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = loginForm.username.value.trim();
        const p = loginForm.password.value.trim();
        if (!u || !p) return alert('Заполните поля');

        try {
            const res = await fetch('https://service-taxi31.ru/api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();

            if (data.success && data.user) {
                window.currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(data.user));

                authScreen.style.display = 'none';
                chatApp.style.display = 'flex';
                window.loadChats();
            } else {
                alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (err) {
            console.error('Ошибка подключения:', err);
            alert('Не удалось подключиться к серверу');
        }
    });

    // === Выход из аккаунта ===
    [logoutBtn, logoutFromProfile].forEach(btn => {
        btn?.addEventListener('click', () => {
            if (window.statusInterval) clearInterval(window.statusInterval);
            window.currentUser = null;
            window.currentChatId = null;
            chatApp.style.display = 'none';
            authScreen.style.display = 'block';
            localStorage.removeItem('currentUser');
        });
    });

    // === Переключение темы ===
    themeToggle?.addEventListener('change', () => {
        document.body.classList.toggle('dark', themeToggle.checked);
    });

    // Восстановление сохранённой темы
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
        themeToggle.checked = true;
    }

    // === Профиль ===
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

    // === Меню (адаптив) ===
    menuToggle?.addEventListener('click', () => {
        sidebar.classList.add('hidden');
        overlayLeft.classList.add('active');
    });

    overlayLeft?.addEventListener('click', () => {
        sidebar.classList.remove('hidden');
        overlayLeft.classList.remove('active');
    });

    // === Адаптивность при изменении размера окна ===
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            sidebar.classList.remove('hidden');
            overlayLeft.classList.remove('active');
            profilePanel.classList.remove('open');
            overlayRight.classList.remove('active');
        }
    });

    // === Отправка сообщения ===
    sendBtn?.addEventListener('click', async () => {
        const text = messageInput.value.trim();
        if (!text || !window.currentChatId || !window.currentUser) return;

        const success = await window.sendMessage(text, window.currentChatId, window.currentUser.id);
        if (success) {
            messageInput.value = '';
        }
    });

    // Отправка по Enter
    messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendBtn?.click();
        }
    });

    console.log('✅ main.js инициализирован');
});
