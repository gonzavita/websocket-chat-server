// js/socket.js
import { addMessageIfNotExists, updateMessageStatus, updateMessageId } from './ui.js';

let tempIdCounter = 0;

/**
 * Подключается к Socket.IO с user_id и chat_id
 * @param {number} chatId - ID чата
 * @param {number} userId - ID текущего пользователя
 * @param {string} text - Текст сообщения
 * @param {number|null} replyToId - ID сообщения, на которое отвечаем (опционально)
 */
// Проверка поддержки уведомлений
if ('Notification' in window) {
    Notification.requestPermission();
}

// Отправка уведомления
function showNotification(username, message) {
    if (Notification.permission === 'granted') {
        new Notification(`${username}`, {
            body: message,
            icon: '/favicon.ico'
        });
    }
}

export function connectToChat(chatId, userId) {
    if (!userId) {
        console.error('❌ Не указан user_id');
        return;
    }

    // Если уже подключены к этому чату — выходим
    if (window.socket && window.currentChatId === chatId) {
        console.log('🟢 Уже подключены к чату', chatId);
        return;
    }

    // Отключаем старое соединение
    if (window.socket) {
        window.socket.off('connect');
        window.socket.off('disconnect');
        window.socket.off('new_message');
        window.socket.off('message_read');
        window.socket.off('connect_error');
        window.socket.off('online_update'); // очищаем предыдущие слушатели
        window.socket.disconnect();
    }

    console.log('🌐 Подключаемся к https://service-taxi31.ru');
    window.socket = io({
        query: { user_id: userId, chat_id: chatId },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        timeout: 10000
    });

    window.currentChatId = chatId;
    window.currentUser = { id: userId };

    // Событие: подключение установлено
    window.socket.on('connect', () => {
        
        const chatId = window.currentChatId;
        if (chatId) {
            window.socket.emit('join', { chat_id: chatId });
            

            // Обновляем статус "в сети" в шапке
            import('./ui.js').then(m => m.setConnectionStatus());
        } else {
            console.warn('⚠️ Нет активного чата при подключении');
        }
    });

    // Событие: кто-то вошёл/вышел из онлайна
    window.socket.on('online_update', (data) => {
        

        // Обновляем статус в шапке чата, если он открыт
        if (window.currentChatId) {
            import('./ui.js').then(m => m.setConnectionStatus());
        }

        // Обновляем список чатов (чтобы зелёная точка появилась/исчезла)
        if (typeof window.loadChats === 'function') {
            window.loadChats();
        }
    });

    // Событие: потеря соединения
    window.socket.on('disconnect', () => {
        console.log('🔴 Соединение разорвано');
    });

    // Событие: ошибка подключения
    window.socket.on('connect_error', (err) => {
        console.error('❌ Ошибка подключения:', err);
    });

    // Событие: новое сообщение
    window.socket.on('new_message', (msg) => {
    const isMine = String(msg.sender_id) === String(window.currentUser.id);
    if (isMine) return;

    import('./ui.js').then(m => m.addMessageIfNotExists(
        msg.content,
        false,
        new Date(msg.sent_at),
        'received',
        msg.id
    ));

    // ✅ Показываем уведомление
    getInterlocutorName(window.currentChatId).then(name => {
        showNotification(name, msg.content);
    });
});

// Вспомогательная функция
async function getInterlocutorName(chatId) {
    try {
        const res = await fetch(`/api/chat_participants?chat_id=${chatId}`);
        const data = await res.json();
        const interlocutor = data.users?.find(u => u.id !== window.currentUser.id);
        return interlocutor?.username || 'Собеседник';
    } catch {
        return 'Собеседник';
    }
}


    // Событие: сообщение прочитано
   window.socket.on('message_read', (data) => {
    console.log('📩 Получено message_read:', data);
    if (String(data.user_id) !== String(window.currentUser.id)) {
        console.log('🔄 Обновляем статус для сообщения:', data.message_id);
        import('./ui.js').then(m => m.updateMessageStatus(data.message_id, 'read'));
    } else {
        console.log('🟡 Это моё прочтение — игнорируем');
    }
});

}

/**
 * Отправляет сообщение через сокет
 * @param {string} text - Текст сообщения
 * @param {number} chatId - ID чата
 */
// js/socket.js
export async function sendMessage(text, chatId, replyToId = null) {
    const socket = window.socket;
    if (!socket?.connected) {
        throw new Error('Сокет не подключён');
    }

    if (window.currentChatId !== chatId) {
        throw new Error('Не подключены к этому чату');
    }

    const tempId = Date.now();

    addMessageIfNotExists(
        text,
        true,
        new Date(),
        'sending',
        tempId
    );

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.warn('⏰ Таймаут отправки сообщения');
            updateMessageStatus(tempId, 'error');
            reject(new Error('Таймаут'));
        }, 10000);

        socket.emit('send_message', { 
            message_text: text,
            reply_to_id: replyToId ? Number(replyToId) : null 
        }, (response) => {
            clearTimeout(timeout);

            if (response?.success) {
                console.log('✅ Сообщение отправлено, ID:', response.message_id);
                updateMessageStatus(tempId, 'delivered');
                updateMessageId(tempId, response.message_id);
                resolve(response);
            } else {
                const errorMsg = response?.error || 'Ошибка сервера';
                console.error('❌ Ошибка отправки:', errorMsg);
                updateMessageStatus(tempId, 'error');
                reject(new Error(errorMsg));
            }
        });
    });
}

/**
 * Отправляет сигнал активности пользователя
 */
export function sendUserActive() {
    if (window.socket?.connected && window.currentUser?.id) {
        window.socket.emit('user_active');
    }
}
