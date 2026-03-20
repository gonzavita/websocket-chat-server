// js/reply-system.js

let replyData = null; // { messageId, messageText, senderName }

const replyPreview = document.createElement('div');
replyPreview.id = 'reply-preview';
replyPreview.className = 'hidden mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm flex items-start gap-2 border-l-4 border-blue-500';

replyPreview.innerHTML = `
    <span class="text-xs text-gray-500 dark:text-gray-400">Ответ</span>
    <div class="flex-1">
        <div id="reply-sender" class="font-medium text-gray-800 dark:text-gray-200"></div>
        <div id="reply-text" class="text-gray-700 dark:text-gray-300 truncate"></div>
    </div>
    <button id="cancel-reply" class="text-gray-500 hover:text-gray-700 dark:text-gray-400">&times;</button>
`;

export function initReplySystem() {
    const inputContainer = document.querySelector('#messageForm').parentElement;
    if (!inputContainer) return;

    inputContainer.insertBefore(replyPreview, inputContainer.firstChild);

    document.getElementById('cancel-reply')?.addEventListener('click', () => {
        cancelReply();
    });

    const messageInput = document.getElementById('messageInput');
    messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelReply();
        }
    });
}

export function replyToMessage(messageElement, messageId, messageText) {
    const isOwn = messageElement.classList.contains('self-end');
    const senderName = isOwn ? 'Вы' : (document.getElementById('chatHeader')?.textContent || 'Собеседник');

    replyData = { messageId, messageText, senderName };

    document.getElementById('reply-sender').textContent = senderName;
    document.getElementById('reply-text').textContent = messageText;
    replyPreview.classList.remove('hidden');

    const input = document.getElementById('messageInput');
    input?.focus();
}

export function getReplyData() {
    return replyData;
}

export function cancelReply() {
    replyData = null;
    replyPreview.classList.add('hidden');
}
