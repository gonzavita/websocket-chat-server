// auth.js — только форма входа
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const u = e.target.username.value.trim();
    const p = e.target.password.value.trim();
    if (!u || !p) return alert('Заполните поля');

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

            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('chatApp').style.display = 'flex';

            if (typeof window.loadChats === 'function') {
                window.loadChats();
            }
        } else {
            alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (err) {
        console.error('Ошибка:', err);
        alert('Не удалось подключиться');
    }
});
