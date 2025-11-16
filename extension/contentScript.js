console.log('🦉 Owl Eyes content script loaded');

let isProcessing = false;
let currentNotification = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
        closeAllNotifications();
        return;
    }
    
    if ((event.key === 'c' || event.code === 'KeyC') && !isInputField(event.target)) {
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            if (isProcessing) {
                showDebugNotification('⚠️ Already processing...', 'warning', 2000);
                return;
            }
            
            event.preventDefault();
            event.stopImmediatePropagation();
            
            showDebugNotification('🦉 Capturing screen...', 'info', 2000);
            processCapture();
        }
    }
}, true);

function closeAllNotifications() {
    removeExistingElement('owl-capture-indicator');
    removeExistingElement('owl-answer-notification');
    removeExistingElement('owl-result-notification');
    removeExistingElement('owl-error-notification');
    removeExistingElement('owl-debug-notification');
    currentNotification = null;
    console.log('🦉 All notifications closed with Escape key');
}

function isInputField(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const inputTypes = ['input', 'textarea', 'select', 'button'];
    const contentEditable = element.contentEditable === 'true' || element.isContentEditable;
    
    if (tagName === 'input') {
        const type = element.type.toLowerCase();
        const nonTextInputs = ['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'file'];
        if (nonTextInputs.includes(type)) {
            return false;
        }
    }
    
    return inputTypes.includes(tagName) || contentEditable;
}

function processCapture() {
    isProcessing = true;
    
    showCaptureIndicator();
    
    chrome.storage.local.get(['geminiApiKey'], function(result) {
        if (!result.geminiApiKey) {
            showErrorNotification('❌ Please set API key in extension popup');
            isProcessing = false;
            return;
        }
        
        chrome.runtime.sendMessage({
            action: "captureScreenshot",
            question: "short-answer"
        }, function(response) {
            if (chrome.runtime.lastError) {
                showErrorNotification('❌ Extension error: ' + chrome.runtime.lastError.message);
            }
            isProcessing = false;
        });
    });
}

function showCaptureIndicator() {
    removeExistingElement('owl-capture-indicator');
    
    const indicator = document.createElement('div');
    indicator.id = 'owl-capture-indicator';
    indicator.innerHTML = '🦉 Finding answer...';
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2c5530;
        color: white;
        padding: 10px 15px;
        border-radius: 20px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: default;
        user-select: none;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => removeExistingElement('owl-capture-indicator'), 3000);
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "showResult") {
        showResultNotification(request.result);
        sendResponse({status: "success"});
    } else if (request.action === "showError") {
        showErrorNotification('❌ ' + request.error);
        sendResponse({status: "success"});
    } else if (request.action === "processing") {
        sendResponse({status: "success"});
    }
    return true;
});

function showResultNotification(result) {
    removeExistingElement('owl-capture-indicator');
    removeExistingElement('owl-result-notification');
    
    const notification = document.createElement('div');
    notification.id = 'owl-result-notification';
    currentNotification = notification;
    
    notification.innerHTML = `
        <div class="owl-header" style="cursor: move; user-select: none;">
            <strong>🦉 Owl Eyes Analysis</strong>
            <button class="owl-close" style="cursor: pointer;">×</button>
        </div>
        <div class="owl-content">${result}</div>
        <div class="owl-footer">
            <small>Drag to move • Press ESC to close • Auto-closes in 30 seconds</small>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 50px;
        right: 20px;
        background: white;
        border: 3px solid #2c5530;
        border-radius: 15px;
        width: 500px;
        max-height: 70vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        z-index: 10001;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        animation: modalFadeIn 0.4s ease-out;
        cursor: default;
        user-select: none;
    `;
    
    const header = notification.querySelector('.owl-header');
    header.addEventListener('mousedown', startDrag);
    
    function startDrag(e) {
        if (e.button !== 0) return;
        
        isDragging = true;
        const rect = notification.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        
        notification.style.transition = 'none';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        
        e.preventDefault();
    }
    
    function onDrag(e) {
        if (!isDragging) return;
        
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        const maxX = window.innerWidth - notification.offsetWidth;
        const maxY = window.innerHeight - notification.offsetHeight;
        
        notification.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        notification.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        notification.style.right = 'auto';
    }
    
    function stopDrag() {
        isDragging = false;
        notification.style.transition = 'all 0.3s ease';
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }
    
    const closeButton = notification.querySelector('.owl-close');
    closeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: 10px;
        right: 15px;
        transition: background 0.2s;
    `;
    
    closeButton.onmouseover = function() { this.style.background = '#f0f0f0'; };
    closeButton.onmouseout = function() { this.style.background = 'none'; };
    closeButton.onclick = () => {
        console.log('🦉 Result notification closed by user');
        notification.remove();
        currentNotification = null;
    };
    
    const content = notification.querySelector('.owl-content');
    content.style.cssText = `
        padding: 20px;
        max-height: 50vh;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        line-height: 1.6;
        cursor: text;
        user-select: text;
    `;
    
    header.style.cssText = `
        background: #2c5530;
        color: white;
        padding: 20px;
        margin: 0;
        position: relative;
        font-size: 16px;
        cursor: move;
        user-select: none;
    `;
    
    const footer = notification.querySelector('.owl-footer');
    footer.style.cssText = `
        padding: 12px 20px;
        background: #f8f9fa;
        border-top: 1px solid #e9ecef;
        text-align: center;
        color: #6c757d;
        font-size: 12px;
        user-select: none;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
            currentNotification = null;
            console.log('🦉 Result notification auto-removed');
            showDebugNotification('🔒 Analysis closed automatically', 'info', 2000);
        }
    }, 30000);
}

function showAnswerNotification(answer) {
    removeExistingElement('owl-capture-indicator');
    removeExistingElement('owl-answer-notification');
    
    const notification = document.createElement('div');
    notification.id = 'owl-answer-notification';
    currentNotification = notification;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; cursor: move; user-select: none;" class="answer-header">
            <div style="font-size: 20px;">🦉</div>
            <div style="font-weight: bold; font-size: 16px;">${answer}</div>
            <button style="
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
                margin-left: auto;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
        </div>
        <div style="font-size: 10px; color: #666; text-align: center; margin-top: 5px; user-select: none;">
            Drag to move • Press ESC to close
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 3px solid #2c5530;
        border-radius: 12px;
        padding: 15px;
        font-family: Arial, sans-serif;
        z-index: 10001;
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        min-width: 200px;
        animation: slideIn 0.3s ease-out;
        cursor: default;
        user-select: none;
    `;
    
    const header = notification.querySelector('.answer-header');
    header.addEventListener('mousedown', startDrag);
    
    function startDrag(e) {
        if (e.button !== 0) return;
        
        isDragging = true;
        const rect = notification.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        
        notification.style.transition = 'none';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        
        e.preventDefault();
    }
    
    function onDrag(e) {
        if (!isDragging) return;
        
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        const maxX = window.innerWidth - notification.offsetWidth;
        const maxY = window.innerHeight - notification.offsetHeight;
        
        notification.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        notification.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        notification.style.right = 'auto';
    }
    
    function stopDrag() {
        isDragging = false;
        notification.style.transition = 'all 0.3s ease';
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }
    
    const closeButton = notification.querySelector('button');
    closeButton.onmouseover = function() { this.style.background = '#f0f0f0'; };
    closeButton.onmouseout = function() { this.style.background = 'none'; };
    closeButton.onclick = () => {
        notification.remove();
        currentNotification = null;
    };
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
            currentNotification = null;
        }
    }, 15000);
}

function showErrorNotification(message) {
    removeExistingElement('owl-error-notification');
    
    const notification = document.createElement('div');
    notification.id = 'owl-error-notification';
    currentNotification = notification;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${message}</span>
            <button style="
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                color: #666;
                margin-left: 10px;
            ">×</button>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fed7d7;
        color: #c53030;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 10002;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid #fc8181;
        cursor: default;
        user-select: none;
    `;
    
    const closeButton = notification.querySelector('button');
    closeButton.onclick = () => {
        notification.remove();
        currentNotification = null;
    };
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
            currentNotification = null;
        }
    }, 5000);
}

function showDebugNotification(message, type = 'info', duration = 3000) {
    removeExistingElement('owl-debug-notification');
    
    const notification = document.createElement('div');
    notification.id = 'owl-debug-notification';
    notification.textContent = message;
    
    const baseStyle = `
        position: fixed;
        top: 10px;
        left: 10px;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: bold;
        z-index: 10002;
        cursor: default;
        user-select: none;
    `;
    
    if (type === 'error') {
        notification.style.cssText = baseStyle + `background: #fed7d7; color: #c53030; border: 1px solid #fc8181;`;
    } else if (type === 'success') {
        notification.style.cssText = baseStyle + `background: #c6f6d5; color: #2c5530; border: 1px solid #68d391;`;
    } else {
        notification.style.cssText = baseStyle + `background: #bee3f8; color: #2c5530; border: 1px solid #90cdf4;`;
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => removeExistingElement('owl-debug-notification'), duration);
}

function removeExistingElement(id) {
    const existing = document.getElementById(id);
    if (existing) {
        existing.remove();
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes modalFadeIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

console.log('🦉 Owl Eyes content script initialized - Press C for answers, ESC to close');
showDebugNotification('🦉 Ready! Press C for answers, ESC to close', 'success', 3000);