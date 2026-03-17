// js/globals.js

window.giga_addMessage = function (text, isSent, time, status = 'sent', messageId = null) {
   
    if (!window.currentUser || !window.currentUser.id) {
        console.warn('❌ currentUser не загружен');
        return;
    }

    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) {
        console.warn('❌ #messages не найден');
        return;
    }

    if (typeof time === 'string') time = new Date(time);
    if (!(time instanceof Date) || isNaN(time.getTime())) {
        time = new Date();
    }

    const timestamp = Math.floor(time.getTime() / 1000);

    const lastGroup = messagesContainer.lastElementChild;
    const lastBubble = lastGroup?.querySelector('.bubble');

    const canGroup =
        lastBubble &&
        lastBubble.classList.contains(isSent ? 'is-out' : 'is-in') &&
        isRecent(lastBubble.dataset.timestamp);

    let group;

    if (canGroup) {
        group = lastGroup;
    } else {
        group = document.createElement('div');
        group.className = 'bubbles-group';
        group.style.display = 'flex';
        group.style.flexDirection = 'column';
        group.style.alignItems = isSent ? 'flex-end' : 'flex-start';
        group.style.maxWidth = '80%';
        group.style.margin = '4px 0';
        messagesContainer.appendChild(group);
    }

    const bubble = document.createElement('div');
    bubble.className = `bubble ${isSent ? 'is-out' : 'is-in'} ${status}`;
    bubble.dataset.mid = messageId || Date.now();
    bubble.dataset.timestamp = timestamp;

    bubble.innerHTML = `
        <div class="bubble-content-wrapper">
            <div class="message">${escapeHtml(text)}</div>
            <span class="time">
                <span class="time-inner">${formatTime(time)}</span>
                <span class="status-icon"></span>
            </span>
        </div>
    `;

    group.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

function formatTime(date) {
    return date.getHours().toString().padStart(2, '0') + ':' +
           date.getMinutes().toString().padStart(2, '0');
}

function isRecent(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    return now - parseInt(timestamp) < 300;
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
