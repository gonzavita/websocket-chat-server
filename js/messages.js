// js/messages.js
import { addMessageToChat } from './ui.js';

/**
 * Загрузка истории сообщений (через API)
 */
export async function loadMessagesHistory(chatId) {
    try {
        const res = await fetch(
            `https://service-taxi31.ru/api/messages.php?action=get&chat_id=${chatId}&last_id=0&limit=100`
        );
        const result = await res.json();

        if (result.messages && Array.isArray(result.messages)) {
            result.messages.forEach(addMessageToChat);
        } else {
            console.warn('Нет сообщений в ответе:', result);
        }
    } catch (err) {
        console.error('Ошибка загрузки истории:', err);
    }
}

/**
 * Отмечает сообщение как прочитанное
 */
export async function markAsRead(messageId, userId) {
    if (!messageId || !userId) return;

    try {
        await fetch('https://service-taxi31.ru/api/messages.php?action=read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id: messageId, user_id: userId })
        });
    } catch (err) {
        console.warn('Ошибка отметки прочтения:', err);
    }
}

/**
 * Получает статус прочтения
 */
export async function getReadStatus(chatId, messageIds) {
    try {
        const res = await fetch(
            `https://service-taxi31.ru/api/messages.php?action=read_status&chat_id=${chatId}&message_ids=${messageIds.join(',')}&user_id=${window.currentUser.id}`
        );
        const data = await res.json();

        const readBy = data.read_by || {};
        const statuses = {};
        for (const msgId of messageIds) {
            const readers = readBy[msgId] || [];
            const hasOtherUserRead = readers.length > 0 && !readers.includes(window.currentUser.id);
            statuses[msgId] = hasOtherUserRead ? 'read' : 'delivered';
        }

        return statuses;
    } catch (err) {
        console.error('Ошибка проверки прочтения:', err);
        return {};
    }
}
