// js/search.js
import { createChatWith } from './chats.js';

const searchInput = document.getElementById('searchUsers');
const searchResults = document.getElementById('searchResults');

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
           const res = await fetch(`https://service-taxi31.ru/api/search_users?user_id=${window.currentUser.id}&q=${encodeURIComponent(q)}`);

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
export function sendUserActive() {
    if (!window.socket || !window.currentUser) return;

    window.socket.emit('user_active', {
        user_id: window.currentUser.id
    });
}