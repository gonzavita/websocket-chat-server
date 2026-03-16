import { createChatWith } from './chats.js';

// Находим элементы
const searchInput = document.getElementById('searchUsers');
const searchResults = document.getElementById('searchResults'); // ← теперь существует

// Если searchResults нет (например, на мобильном) — можно не инициализировать
if (!searchInput) {
    console.warn('❌ #searchUsers не найден');
} else {
    searchInput.oninput = async () => {
        if (!window.currentUser || !window.currentUser.id) {
            if (searchResults) searchResults.style.display = 'none';
            return;
        }

        const q = searchInput.value.trim();
        if (q.length < 2) {
            if (searchResults) searchResults.style.display = 'none';
            return;
        }

        try {
            const res = await fetch(
                `https://service-taxi31.ru/api/search_users.php?user_id=${window.currentUser.id}&q=${encodeURIComponent(q)}`
            );
            const data = await res.json();

            if (searchResults) {
                searchResults.innerHTML = '';
                data.users.forEach(user => {
                    const div = document.createElement('div');
                    div.className = 'chat-item';
                    div.innerHTML = `
                        ${user.username} 
                        <small>${user.online ? '🟢 онлайн' : '⚪ оффлайн'}</small>
                    `;
                    div.onclick = () => createChatWith(user.id, user.username);
                    searchResults.appendChild(div);
                });
                searchResults.style.display = 'block';
            }
        } catch (err) {
            console.error('Ошибка поиска:', err);
        }
    };
}
