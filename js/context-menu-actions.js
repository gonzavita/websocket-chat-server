// js/context-menu-actions.js

import { replyToMessage } from './reply-system.js';

/**
 * Обработчик кликов по пунктам контекстного меню
 * @param {HTMLElement} contextMenu - DOM-элемент меню
 */
export function setupContextMenuActions(contextMenu) {
    contextMenu.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const messageBubble = document.querySelector('.message-bubble.highlighted');
        const currentMessageElement = messageBubble || window.currentMessageElement;

        if (!currentMessageElement) return;

        // === ИСПРАВЛЕНО: data-mid на самом элементе ===
        const messageId = currentMessageElement.dataset.mid || null;
        const messageText = currentMessageElement.querySelector('span.block')?.textContent || '';

        switch (action) {
            case 'reply':
                replyToMessage(currentMessageElement, messageId, messageText);
                break;

            case 'edit':
                handleEdit(messageId, messageText, currentMessageElement);
                break;

            case 'copy':
                handleCopy(messageText);
                break;

            case 'forward':
                handleForward(messageText);
                break;

            case 'pin':
                handlePin(messageId);
                break;

            case 'delete':
                handleDelete(messageId, currentMessageElement);
                break;

            case 'select':
                handleSelect(currentMessageElement);
                break;

            default:
                console.warn('Неизвестное действие:', action);
        }

        // Закрываем меню
        contextMenu.classList.add('hidden');
    });
}

// === Функции действий ===

function handleEdit(messageId, text, element) {
    if (confirm('Редактировать сообщение?')) {
        alert(`Редактирование: ${messageId}`);
        // TODO: реализуем позже
    }
}

function handleCopy(text) {
    navigator.clipboard.writeText(text).then(() => {
        showTooltip('Текст скопирован!');
    }).catch(() => {
        alert('Не удалось скопировать');
    });
}

function handleForward(text) {
    alert(`Переслать: "${text}"`);
    // TODO: выбрать чат
}

function handlePin(messageId) {
    alert(`Закрепить сообщение: ${messageId}`);
    // TODO: API
}

function handleDelete(messageId, element) {
    const mode = confirm('Удалить у всех?\n\n[ОК] — у всех\n[Отмена] — только у себя');
    if (mode) {
        alert(`🗑️ Сообщение ${messageId} удалено у всех`);
        // TODO: запрос на сервер
    } else {
        element.remove();
        showTooltip('Сообщение удалено');
    }
}

function handleSelect(element) {
    const range = document.createRange();
    const textNode = element.querySelector('span.block');
    range.selectNodeContents(textNode);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

// Вспомогательная функция: тултип
function showTooltip(text) {
    let tooltip = document.getElementById('context-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'context-tooltip';
        tooltip.className = 'fixed z-50 bg-black text-white px-3 py-1 rounded text-sm pointer-events-none opacity-0 transition-opacity duration-200';
        document.body.appendChild(tooltip);
    }

    tooltip.textContent = text;
    tooltip.classList.remove('opacity-0');
    tooltip.classList.add('opacity-100');

    setTimeout(() => {
        tooltip.classList.remove('opacity-100');
        tooltip.classList.add('opacity-0');
    }, 1500);
}
