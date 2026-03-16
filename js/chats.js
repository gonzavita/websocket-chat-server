import { openChat } from './ui.js';

export async function createChatWith(userId, username) {
    try {
        const res = await fetch('https://service-taxi31.ru/api/chats.php?action=create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.currentUser.id, interlocutor_id: userId })
        });
        const data = await res.json();
        if (data.success) {
            loadChats(); // обновляем список чатов
            const searchResults = document.getElementById('searchResults');
            const searchInput = document.getElementById('searchUsers');
            if (searchResults) searchResults.style.display = 'none';
            if (searchInput) searchInput.value = '';
            
            // 🔽 Убрали alert
            // А можно добавить тихое уведомление (см. вариант 2)
        }
    } catch (err) {
        console.error('Ошибка создания чата:', err);
    }
}



export async function loadChats() {
    if (!window.currentUser || !window.currentUser.id) {
        console.error('❌ Пользователь не авторизован');
        return;
    }

    const chatList = document.getElementById('chatsList');
    if (!chatList) return;

    try {
        const res = await fetch(`https://service-taxi31.ru/api/chats.php?action=list&user_id=${window.currentUser.id}`);
        const data = await res.json();

        chatList.innerHTML = '';

        if (data.success && Array.isArray(data.chats)) {
            data.chats.forEach(chat => {
                const name = chat.display_name || chat.name || 'Без имени';
                const firstChar = name.charAt(0).toUpperCase();
                const lastMessageText = chat.last_message || 'Нет сообщений';

                const div = document.createElement('div');
                div.className = 'chat-item';
                div.dataset.chatId = chat.id;
                div.innerHTML = `
                    <div class="chat-avatar">${firstChar}</div>
                    <div class="chat-info">
                        <div class="chat-name">${name}</div>
                        <div class="chat-preview">${lastMessageText}</div>
                    </div>
                `;
                div.onclick = () => openChat(chat.id, name);
                chatList.appendChild(div);
            });
        } else {
            chatList.innerHTML = '<div>Нет чатов</div>';
        }
    } catch (err) {
        console.error('Ошибка загрузки чатов:', err);
    }
}


