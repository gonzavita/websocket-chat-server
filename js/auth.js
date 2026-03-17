// js/auth.js — с мгновенной маской телефона

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authScreen = document.getElementById('authScreen');
    const chatApp = document.getElementById('chatApp');

    const toRegister = document.getElementById('toRegister');
    const toLogin = document.getElementById('toLogin');

    // Функция маски
    function applyPhoneMask() {
        const phoneInput = document.getElementById('phoneInput');
        if (!phoneInput || phoneInput.hasAttribute('data-masked')) return;

        phoneInput.setAttribute('data-masked', 'true');

        phoneInput.onfocus = function () {
            if (!this.value || this.value === '+7') {
                this.value = '+7 ';
                setTimeout(() => this.setSelectionRange(3, 3), 10);
            }
        };

        phoneInput.oninput = function () {
            const start = this.selectionStart;
            const raw = this.value.replace(/\D/g, '');
            let clean = raw;

            if (clean.startsWith('8') && clean.length > 1) clean = '7' + clean.slice(1);
            else if (!clean.startsWith('7')) clean = '7' + clean;
            clean = clean.slice(0, 11);

            let formatted = '+7 ';
            if (clean.length >= 4) {
                formatted = `+7 (${clean.slice(1, 4)})`;
                if (clean.length >= 7) {
                    formatted += ` ${clean.slice(4, 7)}`;
                    if (clean.length >= 9) {
                        formatted += `-${clean.slice(7, 9)}`;
                        if (clean.length >= 11) {
                            formatted += `-${clean.slice(9, 11)}`;
                        }
                    }
                }
            } else if (clean.length > 1) {
                formatted = `+7 (${clean.slice(1)}`;
            }

            if (formatted !== this.value) {
                const oldVal = this.value;
                this.value = formatted;
                const delta = formatted.length - oldVal.length;
                this.setSelectionRange(start + delta, start + delta);
            }
        };
    }

    // Переключение на регистрацию
    toRegister?.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        setTimeout(applyPhoneMask, 100); // применяем сразу
    });

    // Переключение на вход
    toLogin?.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // Если форма регистрации была видима при загрузке
    if (registerForm && window.getComputedStyle(registerForm).display !== 'none') {
        setTimeout(applyPhoneMask, 150);
    }

    // === Форма входа ===
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const u = e.target.username.value.trim();
        const p = e.target.password.value.trim();
        if (!u || !p) {
            alert('Заполните все поля');
            return;
        }

        try {
            const res = await fetch('https://service-taxi31.ru/api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });

            const data = await res.json();
            if (data.success) {
                window.currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(data.user));

                authScreen.style.display = 'none';
                chatApp.style.display = 'flex';

                if (typeof window.loadChats === 'function') {
                    window.loadChats();
                }
            } else {
                alert('Ошибка: ' + (data.error || 'Неверный логин или пароль'));
            }
        } catch (err) {
            console.error('Ошибка подключения:', err);
            alert('Не удалось подключиться к серверу');
        }
    });
});
