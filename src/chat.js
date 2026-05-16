document.addEventListener('DOMContentLoaded', function() {

    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') document.body.classList.add('dark-theme');
    
    // Глобальные переменные
    let token = localStorage.getItem('token');
    const myUserId = localStorage.getItem('myUserId');
    const myPhone = localStorage.getItem('myPhone');
    const myEmail = localStorage.getItem('myEmail');
    const myIdentifier = myPhone || myEmail;
    
    let currentChatUser = null;
    let currentChatIdentifier = null;
    let currentFriendId = null;
    let contextMessageId = null;
    let contextMessageText = '';
    let contextMessageFile = null;
    let contextMessageIsMine = false;
    let replyToMessageId = null;
    let editingMessageId = null;
    let selectedFiles = [];
    
    // Голосовые сообщения
    let mediaRecorder = null;
    let recordedChunks = [];
    let voiceRecordingTimer = null;
    let voiceRecordingSeconds = 0;
    let voiceBlob = null;
    let voiceStream = null;
    
    const defaultAvatar = '/uploads/avatars/default-avatar.svg';
    
    // Проверка авторизации
    if (!token || !myUserId) {
        window.location.href = 'login.html';
        return;
    }    
    // Экранирование
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Преобразование гиперсылки
    function linkifyText(htmlText) {
        if (!htmlText) return '';
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        return htmlText.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`);
    }
    
    // Показ уведомлений
    function showNotificationModal(message, type = 'info') {
        const modalEl = document.getElementById('notificationModal');
        if (!modalEl) return;
        
        const titles = { success: 'Успешно', error: 'Ошибка', info: 'Информация', warning: 'Внимание' };
        const titleEl = document.getElementById('notificationModalTitle');
        const messageEl = document.getElementById('notificationModalMessage');
        
        if (titleEl) titleEl.textContent = titles[type] || titles.info;
        if (messageEl) messageEl.textContent = message;
        
        new bootstrap.Modal(modalEl).show();
    }
    
    // Обрезание сообщения  
    function truncateMessage(text, maxLength = 50) {
        if (!text) return '';
        const firstParagraph = text.split('\n')[0];
        if (firstParagraph.length <= maxLength) return firstParagraph;
        return firstParagraph.substring(0, maxLength) + '...';
    }
    
    const showToast = showNotificationModal;
    
    // Последний визит
    function formatLastSeen(lastSeen) {
        if (!lastSeen || lastSeen === 'null' || lastSeen === 'undefined' || lastSeen === '') return 'Неизвестно';
        const date = new Date(lastSeen);
        if (isNaN(date.getTime())) return lastSeen;
        
        const diff = Date.now() - date;
        if (diff < 5 * 60 * 1000) return 'В сети';
        if (diff < 60 * 60 * 1000) return 'Был(а) недавно';
        if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60*60*1000))} часов назад`;
        if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24*60*60*1000))} дней назад`;
        return date.toLocaleDateString('ru-RU');
    }
    
    // Определние типа файла
    function getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const types = {
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
            video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'],
            audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'webm', 'm4a'],
            archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']
        };
        for (const [type, extensions] of Object.entries(types)) {
            if (extensions.includes(ext)) return type;
        }
        return 'document';
    }
    
    // Иконка файла
    function getFileIcon(filename, fileType) {
        const ext = filename.split('.').pop().toUpperCase();
        const colorMap = { document: '#4285f4', image: '#34a853', video: '#ea4335', audio: '#fbbc04', archive: '#9c27b0', default: '#607d8b' };
        return `<svg viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="${colorMap[fileType] || colorMap.default}"/>
            <path d="M14 10h8v6h6v14a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" fill="white" opacity="0.9"/>
            <path d="M18 10v6h6" stroke="white" stroke-width="2" fill="none"/>
            <text x="50%" y="70%" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="Arial">${ext.substring(0, 3)}</text>
        </svg>`;
    }
    
    // Черновик
    function saveDraft(friendId) {
        const msgInput = document.getElementById('messageText');
        if (!msgInput) return;
        const text = msgInput.value.trim();
        if (text) localStorage.setItem('draft_' + friendId, text);
        else localStorage.removeItem('draft_' + friendId);
    }
    
    function loadDraft(friendId) {
        const draft = localStorage.getItem('draft_' + friendId);
        const msgInput = document.getElementById('messageText');
        if (draft && msgInput) msgInput.value = draft;
    }
    
    function cancelReply() {
        replyToMessageId = null;
        const replyPreview = document.getElementById('replyPreview');
        if (replyPreview) replyPreview.style.display = 'none';
    }
    
    // Обновление непрочитанных
    async function refreshUnreadCounts() {
        try {
            const res = await fetchWithAuth('/api/messages/unread-count');
            if (!res.ok) return;
            const counts = await res.json();
            
            document.querySelectorAll('#contactsList li[data-contact-id]').forEach(item => {
                const contactId = parseInt(item.getAttribute('data-contact-id'));
                const count = counts[contactId] || 0;
                let badge = item.querySelector('.unread-badge');
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'unread-badge';
                        const nameSpan = item.querySelector('span[style*="flex-grow"]');
                        if (nameSpan) nameSpan.after(badge);
                    }
                    badge.textContent = count;
                } else if (badge) badge.remove();
            });
        } catch (err) {}
    }
    
    // Проверка токена
    
    function isTokenExpired(token) {
        if (!token) return true;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return Date.now() >= payload.exp * 1000;
        } catch {
            return true;
        }
    }
    
    async function refreshTokenAndRetry() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;
        
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }
    
    function logoutAndRedirect() {
        localStorage.clear();
        window.location.href = 'login.html';
    }
    
    async function fetchWithAuth(url, options = {}) {
        let currentToken = localStorage.getItem('token');
        
        if (isTokenExpired(currentToken)) {
            const refreshed = await refreshTokenAndRetry();
            if (refreshed) currentToken = localStorage.getItem('token');
            else {
                logoutAndRedirect();
                throw new Error('Сессия истекла');
            }
        }
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.status === 401) {
            const refreshed = await refreshTokenAndRetry();
            if (refreshed) {
                const newToken = localStorage.getItem('token');
                return fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers,
                        'Authorization': `Bearer ${newToken}`
                    }
                });
            }
            logoutAndRedirect();
            throw new Error('Сессия истекла');
        }
        
        return response;
    }
    
    // ==================== ЗАГРУЗКА ДАННЫХ ====================
    
    async function loadMyAvatar() {
        try {
            const res = await fetchWithAuth('/api/profile/me');
            if (res.ok) {
                const profile = await res.json();
                if (profile.avatarUrl) localStorage.setItem('myAvatar', profile.avatarUrl);
                const meEl = document.getElementById('me');
                if (meEl) meEl.innerText = profile.displayName || myIdentifier;
            }
        } catch (err) {}
    }
    
    async function loadFriendAvatar(friendId) {
        try {
            const res = await fetchWithAuth(`/api/profile/${friendId}`);
            if (res.ok) {
                const profile = await res.json();
                const avatarEl = document.getElementById('chatHeaderAvatar');
                if (avatarEl) avatarEl.src = profile.avatarUrl || defaultAvatar;
            }
        } catch (err) {}
    }
    
    async function loadFriendProfileSidebar(friendId) {
        try {
            const res = await fetchWithAuth(`/api/profile/${friendId}`);
            if (!res.ok) return;
            const profile = await res.json();
            const sidebarContent = document.getElementById('profileSidebar');
            if (!sidebarContent) return;
            
            let fullName = 'Пользователь';
            if (profile.displayName && profile.lastName) fullName = `${profile.displayName} ${profile.lastName}`;
            else if (profile.displayName) fullName = profile.displayName;
            else if (profile.username) fullName = profile.username;
            
            const emailDisplay = profile.email ? (profile.hideEmail ? `${escapeHtml(profile.email)} 🔒` : escapeHtml(profile.email)) : 'Не указан';
            const phoneDisplay = profile.phone ? (profile.hidePhone ? `${escapeHtml(profile.phone)} 🔒` : escapeHtml(profile.phone)) : 'Не указан';
            
            sidebarContent.innerHTML = `
                <div class="card-body friend-profile-preview p-3">
                    <img src="${profile.avatarUrl || defaultAvatar}" alt="Аватар" class="friend-profile-preview-avatar" onerror="this.src='${defaultAvatar}'">
                    <div class="friend-name">${escapeHtml(fullName)}</div>
                    ${profile.bio ? `<div class="friend-bio">${escapeHtml(profile.bio)}</div>` : ''}
                    <ul class="friend-profile-stats mt-3">
                        <li><span class="stat-label">Email</span><span class="stat-value">${emailDisplay}</span></li>
                        <li><span class="stat-label">Телефон</span><span class="stat-value">${phoneDisplay}</span></li>
                        <li><span class="stat-label">Статус</span><span class="stat-value">${formatLastSeen(profile.lastSeen)}</span></li>
                    </ul>
                </div>
            `;
        } catch (err) {}
    }
    
    async function loadMessages(identifier) {
        const messagesArea = document.getElementById('messagesArea');
        if (!identifier) {
            const chatSidebar = document.getElementById('chatSidebar');
            const profileSidebar = document.getElementById('profileSidebar');
            if (chatSidebar) chatSidebar.style.display = 'block';
            if (profileSidebar) profileSidebar.style.display = 'none';
            if (messagesArea) messagesArea.innerHTML = `<div class="text-center p-5"><div class="text-muted">👈 Выберите контакт слева</div></div>`;
            return;
        }
        
        try {
            const res = await fetchWithAuth(`/api/messages/${encodeURIComponent(identifier)}`);
            if (!res.ok) throw new Error('Не удалось загрузить сообщения');
            
            const msgs = await res.json();
            if (!messagesArea) return;
            
            if (!msgs || msgs.length === 0) {
                messagesArea.innerHTML = '<p class="text-muted text-center p-4">Нет сообщений. Напишите первым(ой)!</p>';
                return;
            }
            
            let lastDate = null;
            let html = '';
            let unreadDividerInserted = false;
            
            msgs.forEach(m => {
                const isMine = m.fromUserId == myUserId;
                const sentAt = m.sentAt ? new Date(m.sentAt) : new Date();
                const timeStr = sentAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const messageDate = sentAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                const dateKey = sentAt.toLocaleDateString('ru-RU');
                
                if (dateKey !== lastDate) {
                    html += `<div class="date-divider"><span>${messageDate}</span></div>`;
                    lastDate = dateKey;
                }
                
                if (!unreadDividerInserted && !isMine && m.isRead === false) {
                    html += `<div class="unread-divider"><span>Новые сообщения</span><span class="unread-divider-date">${messageDate}</span></div>`;
                    unreadDividerInserted = true;
                }
                
                // Удалённое сообщение
                if (m.isDeleted === true) {
                    html += `<div class="message ${isMine ? 'message-mine' : 'message-other'}" id="message-${m.id}">
                        <div class="message-bubble deleted-message">
                            <div class="message-content">
                                <span class="message-text" style="font-style: italic; opacity: 0.6;">Сообщение удалено</span>
                            </div>
                            <span class="message-time">${timeStr}</span>
                        </div>
                    </div>`;
                    return;
                }
                
                // Пересланное сообщение
                let forwardedSenderFullName = 'Неизвестно';
                if (m.forwardedFromUser) {
                    forwardedSenderFullName = m.forwardedLastName ? `${m.forwardedFromUser} ${m.forwardedLastName}` : m.forwardedFromUser;
                } else if (m.forwardedSenderName) {
                    forwardedSenderFullName = m.forwardedSenderName;
                }
                
                const forwardedBlock = m.forwardedMessageId ? `
                    <div class="message-forwarded-block">
                        <div class="forwarded-header">Переслано:</div>
                        <div class="forwarded-sender-name">${escapeHtml(forwardedSenderFullName)}</div>
                        <div class="forwarded-message-text">${linkifyText(escapeHtml(m.messageText || 'Сообщение'))}</div>
                    </div>
                ` : '';
                
                // Рендер сообщения с файлом
                const fileHtml = m.filePath ? renderFileAttachmentWithText(m.filePath, false, m.messageText, isMine) : '';
                const replyHtml = m.replyToId ? `<div class="message-reply-quote" onclick="scrollToMessage(${m.replyToId})" style="cursor: pointer;">
                    <div class="reply-quote-sender">${(m.replyDisplayName && m.replyDisplayName.trim()) ? `${escapeHtml(m.replyDisplayName)}${m.replyLastName ? ' ' + escapeHtml(m.replyLastName) : ''}` : (m.replyFromUserId ? 'Отправитель' : 'Неизвестно')}</div>
                    <div class="reply-quote-content">
                        ${m.replyText ? `<span class="reply-quote-text">${escapeHtml(m.replyText).substring(0, 80)}</span>` : ''}
                        ${m.replyFilePath ? `<span class="reply-quote-file"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>Голосовое сообщение</span>` : ''}
                    </div>
                </div>` : '';
                
                // Обрезаем длинное сообщение до первого абзаца
                const displayMessageText = m.messageText ? truncateMessage(m.messageText, 500) : '';
                
                html += `<div class="message ${isMine ? 'message-mine' : 'message-other'}" id="message-${m.id}">
                    ${m.filePath && !m.messageText ? `
                        <div class="message-file-container" oncontextmenu="showContextMenu(event, ${m.id}, '', '${(m.filePath || '').replace(/'/g, "\\'")}', ${isMine})">
                            ${replyHtml}
                            ${renderFileAttachment(m.filePath, true)}
                            <span class="message-time" style="margin-left:8px;align-self:flex-end;">${timeStr}</span>
                        </div>
                    ` : `
                        <div class="message-bubble" oncontextmenu="showContextMenu(event, ${m.id}, '${(m.messageText || '').replace(/'/g, "\\'")}', '${(m.filePath || '').replace(/'/g, "\\'")}', ${isMine})">
                            <div class="message-content">
                                ${replyHtml}
                                ${forwardedBlock}
                                ${m.messageText && !m.forwardedMessageId ? `<span class="message-text">${linkifyText(escapeHtml(displayMessageText))}</span>` : ''}
                                ${fileHtml}
                            </div>
                            <span class="message-time">${timeStr}</span>
                        </div>
                    `}
                </div>`;
            });
            
            messagesArea.innerHTML = html;
            messagesArea.scrollTop = messagesArea.scrollHeight;
        } catch (err) {
            if (messagesArea) messagesArea.innerHTML = '<p class="text-danger">Ошибка загрузки сообщений</p>';
        }
    }
    
    /** Рендер вложения с текстом */
    function renderFileAttachmentWithText(filePath, isStandalone, messageText, isMine) {
        const fileType = getFileType(filePath);
        const fileName = filePath.split('/').pop();
        
        if (fileType === 'audio') {
            return `<div class="voice-player" data-src="${filePath}">
                <button class="voice-play-btn" type="button">▶</button>
                <div class="voice-progress-wrap">
                    <div class="voice-progress-bar"></div>
                </div>
                <audio preload="metadata" src="${filePath}" style="display:none;"></audio>
            </div>`;
        }
        
        if (fileType === 'image') {
            const textHtml = messageText ? `<div class="message-image-caption">${linkifyText(escapeHtml(messageText))}</div>` : '';
            return `<div class="message-image-with-caption">
                <img src="${filePath}" alt="${fileName}" class="message-image" oncontextmenu="showImageContextMenu(event, '${filePath.replace(/'/g, "\\'")}')">
                ${textHtml}
            </div>`;
        }
        
        const downloadLabel = isStandalone ? '<span class="file-download">Скачать</span>' : '';
        return `<a href="${filePath}" download class="message-attachment">
            <div class="file-icon-wrapper">${getFileIcon(filePath, fileType)}</div>
            <div class="file-info"><div class="file-name">${fileName}</div><div class="file-meta">${downloadLabel}</div></div>
        </a>`;
    }
    
    /** Рендер вложения */
    function renderFileAttachment(filePath, isStandalone) {
        const fileType = getFileType(filePath);
        const fileName = filePath.split('/').pop();
        
        if (fileType === 'audio') {
            return `<div class="voice-player" data-src="${filePath}">
                <button class="voice-play-btn" type="button">▶</button>
                <div class="voice-progress-wrap">
                    <div class="voice-progress-bar"></div>
                </div>
                <audio preload="metadata" src="${filePath}" style="display:none;"></audio>
            </div>`;
        }
        
        if (fileType === 'image') {
            return `<div class="message-image-container">
                <img src="${filePath}" alt="${fileName}" class="message-image" oncontextmenu="showImageContextMenu(event, '${filePath.replace(/'/g, "\\'")}')">
            </div>`;
        }
        
        const downloadLabel = isStandalone ? '<span class="file-download">Скачать</span>' : '';
        return `<a href="${filePath}" download class="message-attachment">
            <div class="file-icon-wrapper">${getFileIcon(filePath, fileType)}</div>
            <div class="file-info"><div class="file-name">${fileName}</div><div class="file-meta">${downloadLabel}</div></div>
        </a>`;
    }
    
    async function loadContacts() {
        try {
            const res = await fetchWithAuth('/api/contacts');
            if (!res.ok) throw new Error('Не удалось загрузить контакты');
            
            const contacts = await res.json();
            const list = document.getElementById('contactsList');
            if (!list) return;
            
            if (!contacts || contacts.length === 0) {
                list.innerHTML = '';
                return;
            }
            
            list.innerHTML = '<li class="list-group-item text-muted">⏳ Загрузка информации о контактах...</li>';
            
            const contactsWithFullInfo = await Promise.all(contacts.map(async (contact) => {
                try {
                    const profileRes = await fetchWithAuth(`/api/profile/${contact.id}`);
                    if (profileRes.ok) {
                        const profile = await profileRes.json();
                        let fullName = 'Пользователь';
                        if (profile.displayName && profile.lastName) fullName = `${profile.displayName} ${profile.lastName}`;
                        else if (profile.displayName) fullName = profile.displayName;
                        else if (profile.username) fullName = profile.username;
                        else if (profile.email) fullName = profile.email;
                        
                        let lastMessage = null;
                        try {
                            const contactIdentifier = profile.email || profile.phone || profile.username || profile.displayName || '';
                            const msgsRes = await fetchWithAuth(`/api/messages/${encodeURIComponent(contactIdentifier)}`);
                            if (msgsRes.ok) {
                                const messages = await msgsRes.json();
                                if (messages && messages.length > 0) lastMessage = messages[messages.length - 1];
                            }
                        } catch {}
                        
                        return { ...contact, fullName, avatarUrl: profile.avatarUrl, email: profile.email, phone: profile.phone, lastMessage };
                    }
                } catch {}
                const fullName = contact.displayName || contact.username || contact.email || 'Пользователь';
                return { ...contact, fullName };
            }));
            
            let unreadCounts = {};
            try {
                const unreadRes = await fetchWithAuth('/api/messages/unread-count');
                if (unreadRes.ok) unreadCounts = await unreadRes.json();
            } catch {}
            
            list.innerHTML = contactsWithFullInfo.map(contact => {
                const unreadCount = unreadCounts[contact.id] || 0;
                const lastMsg = contact.lastMessage || null;
                let lastMsgText = 'Нет сообщений';
                if (lastMsg) {
                    if (lastMsg.filePath && !lastMsg.messageText) {
                        const fileName = lastMsg.filePath.split('/').pop().toLowerCase();
                        lastMsgText = (fileName.endsWith('.webm') || fileName.endsWith('.mp3') || fileName.endsWith('.m4a')) ? 'Голосовое сообщение' : '📎 Файл';
                    } else if (lastMsg.messageText) lastMsgText = lastMsg.messageText;
                    else lastMsgText = 'Сообщение';
                }
                const lastMsgTime = lastMsg && lastMsg.sentAt ? new Date(lastMsg.sentAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
                const badgeHtml = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
                
                // Обрезаем текст последнего сообщения до 15 символов
                let lastMsgTextTruncated = lastMsgText;
                if (lastMsgText && lastMsgText.length > 15) {
                    const firstParagraph = lastMsgText.split('\n')[0];
                    lastMsgTextTruncated = firstParagraph.length > 15 ? firstParagraph.substring(0, 15) + '...' : firstParagraph + '...';
                }
                
                return `
                <li class="list-group-item d-flex align-items-center contact-item" data-contact-id="${contact.id}" onclick="selectChat('${escapeHtml(contact.fullName)}', ${contact.id})">
                    <div style="position: relative; display: flex; align-items: center; gap: 12px; flex-grow: 1;">
                        <img src="${contact.avatarUrl || defaultAvatar}" alt="Аватар" class="contact-avatar" onerror="this.src='${defaultAvatar}'">
                        <div style="flex-grow: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                                <span style="font-weight: 600; ${unreadCount > 0 ? 'color: var(--primary);' : ''}">${escapeHtml(contact.fullName)}</span>
                                ${lastMsgTime ? `<span style="font-size: 0.7rem; color: var(--text-muted);">${lastMsgTime}</span>` : ''}
                            </div>
                            <div style="font-size: 0.85rem; color: ${unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${unreadCount > 0 && lastMsg ? `<strong>${escapeHtml(lastMsgTextTruncated)}</strong>` : escapeHtml(lastMsgTextTruncated)}
                            </div>
                        </div>
                        ${badgeHtml}
                    </div>
                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="event.stopPropagation(); removeContact(${contact.id}, '${escapeHtml(contact.fullName)}')" style="flex-shrink: 0;">✕</button>
                </li>
            `}).join('');
        } catch (err) {
            const list = document.getElementById('contactsList');
            if (list) list.innerHTML = `<li class="list-group-item text-danger">Ошибка: ${err.message}</li>`;
        }
    }
    
    // ==================== ВЫБОР ЧАТА ====================
    
    window.selectChat = async function(fullName, friendId) {
        const chatSidebar = document.getElementById('chatSidebar');
        const profileSidebar = document.getElementById('profileSidebar');
        if (chatSidebar) chatSidebar.style.display = 'none';
        if (profileSidebar) profileSidebar.style.display = 'block';
        
        if (currentChatUser && currentFriendId) saveDraft(currentFriendId);
        
        currentFriendId = friendId;
        currentChatUser = fullName;
        
        try {
            const res = await fetchWithAuth(`/api/profile/${friendId}`);
            if (res.ok) {
                const profile = await res.json();
                
                if (profile.email) currentChatIdentifier = profile.email;
                else if (profile.phone) currentChatIdentifier = profile.phone;
                else if (profile.username) currentChatIdentifier = profile.username;
                else if (profile.displayName) currentChatIdentifier = profile.displayName;
                else currentChatIdentifier = fullName;
                
                let displayFullName = 'Пользователь';
                if (profile.displayName && profile.lastName) displayFullName = `${profile.displayName} ${profile.lastName}`;
                else if (profile.displayName) displayFullName = profile.displayName;
                else if (profile.username) displayFullName = profile.username;
                else if (profile.email) displayFullName = profile.email;
                else displayFullName = fullName;
                currentChatUser = displayFullName;
                
                const chatTitle = document.getElementById('chatTitle');
                const chatLastSeen = document.getElementById('chatLastSeen');
                if (chatTitle) chatTitle.textContent = displayFullName;
                if (chatLastSeen) {
                    chatLastSeen.textContent = formatLastSeen(profile.lastSeen);
                    chatLastSeen.style.display = 'block';
                }
                
                await loadFriendAvatar(friendId);
                await loadFriendProfileSidebar(friendId);
            } else {
                currentChatIdentifier = fullName;
                const chatTitle = document.getElementById('chatTitle');
                const chatLastSeen = document.getElementById('chatLastSeen');
                if (chatTitle) chatTitle.textContent = fullName;
                if (chatLastSeen) chatLastSeen.style.display = 'none';
            }
        } catch (err) {
            currentChatIdentifier = fullName;
            const chatTitle = document.getElementById('chatTitle');
            const chatLastSeen = document.getElementById('chatLastSeen');
            if (chatTitle) chatTitle.textContent = fullName;
            if (chatLastSeen) chatLastSeen.style.display = 'none';
        }
        
        loadDraft(friendId);
        
        const chatAvatar = document.getElementById('chatHeaderAvatar');
        const viewProfileBtn = document.getElementById('viewProfileBtn');
        const msgInput = document.getElementById('messageText');
        const sendBtn = document.getElementById('sendBtn');
        const attachBtn = document.getElementById('attachBtn');
        const voiceBtn = document.getElementById('voiceBtn');
        const inputGroup = document.getElementById('messageInputGroup');
        
        if (chatAvatar) chatAvatar.style.display = 'block';
        if (viewProfileBtn) viewProfileBtn.style.display = 'block';
        if (msgInput) msgInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (attachBtn) attachBtn.disabled = false;
        if (voiceBtn) voiceBtn.disabled = false;
        if (inputGroup) inputGroup.style.display = 'flex';
        
        selectedFiles = [];
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = '';
        cancelReply();
        
        await loadMessages(currentChatIdentifier);
        
        if (friendId) {
            try {
                await fetchWithAuth(`/api/messages/mark-read/${friendId}`, { method: 'POST' });
                const contactItem = document.querySelector(`#contactsList li[data-contact-id="${friendId}"]`);
                if (contactItem) {
                    const badge = contactItem.querySelector('.unread-badge');
                    if (badge) badge.remove();
                }
                await refreshUnreadCounts();
            } catch {}
        }
        
        setTimeout(() => { if (msgInput) msgInput.focus(); }, 100);
    };
    
    // ==================== ОТПРАВКА СООБЩЕНИЙ ====================
    
    function setupSendButton() {
        const sendBtn = document.getElementById('sendBtn');
        if (!sendBtn) return;
        
        sendBtn.onclick = async () => {
            const msgInput = document.getElementById('messageText');
            const text = msgInput ? msgInput.value.trim() : '';
            
            if (!currentChatIdentifier) {
                showToast('Выберите собеседника', 'error');
                return;
            }
            
            if (!text && selectedFiles.length === 0) {
                showToast('Введите сообщение', 'error');
                return;
            }
            
            try {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '...';
                
                const body = { to: currentChatIdentifier, text };
                if (replyToMessageId) body.replyToMessageId = replyToMessageId;
                
                const res = await fetch('/api/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body)
                });
                
                if (!res.ok) throw new Error('Ошибка отправки');
                
                if (msgInput) msgInput.value = '';
                cancelReply();
                if (currentFriendId) localStorage.removeItem('draft_' + currentFriendId);
                await loadMessages(currentChatIdentifier);
            } catch (err) {
                showToast('Ошибка отправки: ' + err.message, 'error');
            } finally {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '➤';
            }
        };
    }
    
    async function sendFiles() {
        if (!currentChatIdentifier || selectedFiles.length === 0) return;
        const sendBtn = document.getElementById('sendBtn');
        if (!sendBtn) return;
        
        try {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '...';
            const formData = new FormData();
            formData.append('to', currentChatIdentifier);
            const msgInput = document.getElementById('messageText');
            formData.append('text', msgInput ? msgInput.value.trim() : '');
            selectedFiles.forEach(file => formData.append('files[]', file));
            
            const res = await fetch('/api/message/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error('Ошибка отправки файлов');
            if (msgInput) msgInput.value = '';
            await loadMessages(currentChatIdentifier);
        } catch (err) {
            showToast('Ошибка отправки: ' + err.message, 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '➤';
            selectedFiles = [];
        }
    }
    
    // ==================== ГОЛОСОВЫЕ СООБЩЕНИЯ ====================
    
    function formatVoiceDuration(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }
    
    async function startVoiceRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            voiceStream = stream;
            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];
            voiceRecordingSeconds = 0;
            voiceBlob = null;
            
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
            
            mediaRecorder.onstop = () => {
                voiceBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                if (voiceStream) { voiceStream.getTracks().forEach(track => track.stop()); voiceStream = null; }
            };
            
            mediaRecorder.start();
            
            const voicePanel = document.getElementById('voiceRecordingPanel');
            const msgInput = document.getElementById('messageText');
            const attachBtn = document.getElementById('attachBtn');
            const voiceBtn = document.getElementById('voiceBtn');
            const sendBtn = document.getElementById('sendBtn');
            
            if (voicePanel) voicePanel.style.display = 'flex';
            if (msgInput) msgInput.style.display = 'none';
            if (attachBtn) attachBtn.style.display = 'none';
            if (voiceBtn) voiceBtn.style.display = 'none';
            if (sendBtn) sendBtn.style.display = 'none';
            
            const timerEl = document.getElementById('voiceRecordingTimer');
            if (timerEl) timerEl.textContent = '00:00';
            voiceRecordingTimer = setInterval(() => {
                voiceRecordingSeconds++;
                if (timerEl) timerEl.textContent = formatVoiceDuration(voiceRecordingSeconds);
            }, 1000);
        } catch (err) {
            showToast('Не удалось получить доступ к микрофону', 'error');
        }
    }
    
    function stopVoiceRecording() {
        return new Promise((resolve) => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.onstop = () => {
                    voiceBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                    if (voiceStream) { voiceStream.getTracks().forEach(track => track.stop()); voiceStream = null; }
                    resolve();
                };
                mediaRecorder.stop();
            } else resolve();
            if (voiceRecordingTimer) { clearInterval(voiceRecordingTimer); voiceRecordingTimer = null; }
        });
    }
    
    function resetVoiceUI() {
        const voicePanel = document.getElementById('voiceRecordingPanel');
        const msgInput = document.getElementById('messageText');
        const attachBtn = document.getElementById('attachBtn');
        const voiceBtn = document.getElementById('voiceBtn');
        const sendBtn = document.getElementById('sendBtn');
        
        if (voicePanel) voicePanel.style.display = 'none';
        if (msgInput) msgInput.style.display = 'block';
        if (attachBtn) attachBtn.style.display = 'flex';
        if (voiceBtn) voiceBtn.style.display = 'flex';
        if (sendBtn) sendBtn.style.display = 'flex';
        
        voiceBlob = null;
        recordedChunks = [];
        voiceRecordingSeconds = 0;
        if (voiceStream) { voiceStream.getTracks().forEach(track => track.stop()); voiceStream = null; }
    }
    
    function cancelVoiceRecording() {
        stopVoiceRecording();
        resetVoiceUI();
    }
    
    async function sendVoiceMessage() {
        if (!currentChatIdentifier) return;
        await stopVoiceRecording();
        if (!voiceBlob) { resetVoiceUI(); return; }
        
        const blobToSend = voiceBlob;
        voiceBlob = null;
        
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '...'; }
        
        try {
            const formData = new FormData();
            formData.append('to', currentChatIdentifier);
            formData.append('text', '');
            const file = new File([blobToSend], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            formData.append('files[]', file);
            
            const res = await fetch('/api/message/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error('Ошибка отправки голосового');
            await loadMessages(currentChatIdentifier);
        } catch (err) {
            showToast('Ошибка отправки голосового: ' + err.message, 'error');
        } finally {
            resetVoiceUI();
            if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '➤'; }
        }
    }
    
    // ==================== УПРАВЛЕНИЕ КОНТАКТАМИ ====================
    
    window.removeContact = async function(contactId, username) {
        if (!confirm(`Удалить ${username} из контактов?`)) return;
        try {
            await fetchWithAuth(`/api/contacts/${contactId}`, { method: 'DELETE' });
            await loadContacts();
            if (currentFriendId === contactId) {
                currentChatUser = null;
                currentChatIdentifier = null;
                currentFriendId = null;
                const messagesArea = document.getElementById('messagesArea');
                if (messagesArea) messagesArea.innerHTML = `<div class="text-center p-5"><div class="text-muted">👈 Выберите контакт слева</div></div>`;
                const chatTitle = document.getElementById('chatTitle');
                if (chatTitle) chatTitle.textContent = 'Выберите контакт для чата';
                const chatLastSeen = document.getElementById('chatLastSeen');
                if (chatLastSeen) { chatLastSeen.textContent = ''; chatLastSeen.style.display = 'none'; }
            }
        } catch (err) {
            showToast('Ошибка удаления', 'error');
        }
    };
    
    // ==================== ПРОФИЛЬ ДРУГА ====================
    
    window.viewFriendProfile = async function() {
        if (!currentFriendId) return;
        try {
            const res = await fetchWithAuth(`/api/profile/${currentFriendId}`);
            if (!res.ok) throw new Error('Профиль не найден');
            const profile = await res.json();
            
            let fullName = profile.displayName || 'Пользователь';
            if (profile.displayName && profile.lastName) fullName = `${profile.displayName} ${profile.lastName}`;
            
            const avatarEl = document.getElementById('friendProfileAvatar');
            const nameEl = document.getElementById('friendProfileName');
            const bioEl = document.getElementById('friendProfileBio');
            const emailEl = document.getElementById('friendProfileEmail');
            const phoneEl = document.getElementById('friendProfilePhone');
            const lastSeenEl = document.getElementById('friendProfileLastSeen');
            
            if (avatarEl) avatarEl.src = profile.avatarUrl || defaultAvatar;
            if (nameEl) nameEl.textContent = fullName;
            if (bioEl) bioEl.textContent = profile.bio || 'Биография не указана';
            if (emailEl) emailEl.textContent = profile.email ? (profile.hideEmail ? `${profile.email} 🔒` : profile.email) : 'Не указан';
            if (phoneEl) phoneEl.textContent = profile.phone ? (profile.hidePhone ? `${profile.phone} 🔒` : profile.phone) : 'Не указан';
            if (lastSeenEl) lastSeenEl.textContent = formatLastSeen(profile.lastSeen);
            
            const modalEl = document.getElementById('friendProfileModal');
            if (modalEl) new bootstrap.Modal(modalEl).show();
        } catch (err) {
            showToast('Ошибка загрузки профиля', 'error');
        }
    };
    
    // ==================== КОНТЕКСТНОЕ МЕНЮ ====================
    
    window.showContextMenu = function(event, messageId, messageText, messageFile = null, isMine = false) {
        event.preventDefault();
        event.stopPropagation();
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;
        
        contextMenu.querySelectorAll('.context-menu-item.copy, .context-menu-item.edit, .context-menu-item.reply, .context-menu-item.forward, .context-menu-item.delete').forEach(btn => {
            btn.style.display = 'block';
        });
        
        const downloadBtn = contextMenu.querySelector('.download-image');
        if (downloadBtn) downloadBtn.style.display = 'none';
        
        const messageEl = document.getElementById(`message-${messageId}`);
        if (!messageEl) { showToast('Сообщение не найдено', 'error'); return; }
        
        const deletedText = messageEl.querySelector('.message-text');
        if (deletedText && deletedText.textContent === 'Сообщение удалено') {
            showToast('Нельзя взаимодействовать с удаленным сообщением', 'error');
            return;
        }
        
        const forwardedBlock = messageEl.querySelector('.message-forwarded-block');
        const isForwarded = !!forwardedBlock;
        const voicePlayer = messageEl.querySelector('.voice-player');
        const audioElement = voicePlayer ? voicePlayer.querySelector('audio') : null;
        const isVoice = !!voicePlayer && !!audioElement;
        
        const copyBtn = contextMenu.querySelector('.context-menu-item.copy');
        const replyBtn = contextMenu.querySelector('.context-menu-item.reply');
        const forwardBtn = contextMenu.querySelector('.context-menu-item.forward');
        const editBtn = contextMenu.querySelector('.context-menu-item.edit');
        const deleteMsgBtn = contextMenu.querySelector('.context-menu-item.delete');
        
        if (copyBtn) copyBtn.style.display = (messageText && messageText.trim() && !isVoice) ? 'block' : 'none';
        if (replyBtn) replyBtn.style.display = 'block';
        if (forwardBtn) forwardBtn.style.display = 'block';
        if (editBtn) editBtn.style.display = (isMine && !isForwarded && !isVoice && messageText && messageText.trim()) ? 'block' : 'none';
        if (deleteMsgBtn) deleteMsgBtn.style.display = isMine ? 'block' : 'none';
        
        let actualText = messageText;
        if (messageEl) {
            const textEl = messageEl.querySelector('.message-text');
            if (textEl && textEl.textContent !== 'Сообщение удалено') actualText = textEl.textContent;
        }
        
        contextMenu.style.display = 'block';
        contextMenu.style.position = 'fixed';
        contextMenu.style.visibility = 'hidden';
        
        const menuWidth = contextMenu.offsetWidth || 180;
        const menuHeight = contextMenu.offsetHeight || 220;
        let left = (event.pageX !== undefined ? event.pageX : event.clientX) || 0;
        let top = (event.pageY !== undefined ? event.pageY : event.clientY) || 0;
        
        if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
        if (top + menuHeight > window.innerHeight - 8) top = window.innerHeight - menuHeight - 8;
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        
        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
        contextMenu.style.visibility = 'visible';
        
        contextMessageId = messageId;
        contextMessageText = actualText;
        contextMessageFile = messageFile;
        contextMessageIsMine = isMine;
        return false;
    };
    
    window.showImageContextMenu = function(event, imageUrl) {
        event.preventDefault();
        event.stopPropagation();
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;
        
        contextMenu.querySelectorAll('.context-menu-item.copy, .context-menu-item.edit, .context-menu-item.reply, .context-menu-item.forward, .context-menu-item.delete').forEach(btn => {
            btn.style.display = 'none';
        });
        
        let downloadBtn = contextMenu.querySelector('.download-image');
        if (!downloadBtn) {
            downloadBtn = document.createElement('div');
            downloadBtn.className = 'context-menu-item download-image';
            downloadBtn.onclick = downloadImageFromContextMenu;
            downloadBtn.textContent = 'Скачать';
            contextMenu.appendChild(downloadBtn);
        } else {
            downloadBtn.style.display = 'block';
        }
        
        contextMenu.style.display = 'block';
        contextMenu.style.position = 'fixed';
        contextMenu.style.visibility = 'hidden';
        
        const menuWidth = contextMenu.offsetWidth || 100;
        const menuHeight = contextMenu.offsetHeight || 40;
        let left = (event.pageX !== undefined ? event.pageX : event.clientX) || 0;
        let top = (event.pageY !== undefined ? event.pageY : event.clientY) || 0;
        
        if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
        if (top + menuHeight > window.innerHeight - 8) top = window.innerHeight - menuHeight - 8;
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        
        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
        contextMenu.style.visibility = 'visible';
        
        window.currentImageContextUrl = imageUrl;
        return false;
    };
    
    window.downloadImageFromContextMenu = async function() {
        const imageUrl = window.currentImageContextUrl;
        if (!imageUrl) {
            showToast('Не удалось получить URL изображения', 'error');
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu) contextMenu.style.display = 'none';
            return;
        }
        
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = imageUrl.split('/').pop() || 'image.jpg';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu) contextMenu.style.display = 'none';
        } catch (err) {
            showToast('Не удалось скачать изображение', 'error');
        }
    };
    
    window.replyContextMenuMessage = function() {
        if (!contextMessageId || !currentChatIdentifier) { showToast('Нет сообщения для ответа', 'error'); return; }
        replyToMessageId = contextMessageId;
        showReplyPreview();
        const msgInput = document.getElementById('messageText');
        if (msgInput) msgInput.focus();
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) contextMenu.style.display = 'none';
    };
    
    window.deleteContextMenuMessage = function() {
        if (contextMessageId) deleteMessage(contextMessageId);
    };
    
    window.editContextMenuMessage = function() {
        if (!contextMessageId) return;
        if (!contextMessageIsMine) { showToast('Нельзя редактировать чужие сообщения', 'error'); return; }
        if (!contextMessageText || contextMessageText.trim() === '') { showToast('Нельзя редактировать файлы без текста', 'error'); return; }
        editMessage(contextMessageId, contextMessageText);
    };
    
    window.forwardContextMenuMessage = function() {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) contextMenu.style.display = 'none';
        if (contextMessageId) showForwardModal();
    };
    
    window.copyContextMenuMessage = async function() {
        const textToCopy = contextMessageText ? contextMessageText.trim() : '';
        if (!textToCopy) { showToast('Нет текста для копирования', 'error'); return; }
        try {
            await navigator.clipboard.writeText(textToCopy);
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu) contextMenu.style.display = 'none';
        } catch (err) {
            showToast('Не удалось скопировать текст', 'error');
        }
    };
    
    async function showReplyPreview() {
        let message = null;
        const messageEl = document.getElementById(`message-${contextMessageId}`);
        if (messageEl) {
            const textEl = messageEl.querySelector('.message-text');
            const fileEl = messageEl.querySelector('.file-name');
            if (textEl) message = { messageText: textEl.textContent };
            else if (fileEl) message = { filePath: fileEl.textContent };
        }
        
        const replyPreview = document.getElementById('replyPreview');
        const replyContent = document.getElementById('replyContent');
        if (!replyPreview || !replyContent) return;
        
        if (message && message.filePath && !message.messageText) {
            replyContent.innerHTML = `<span class="reply-file-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></span><span class="reply-file-name">${message.filePath.split('/').pop()}</span>`;
        } else if (message && message.messageText) {
            replyContent.innerHTML = `<span class="reply-text">"${message.messageText.substring(0, 100)}${message.messageText.length > 100 ? '...' : ''}"</span>`;
        } else {
            replyContent.innerHTML = `<span class="reply-text">Сообщение</span>`;
        }
        replyPreview.style.display = 'block';
    }
    
    window.cancelReply = function() {
        replyToMessageId = null;
        const replyPreview = document.getElementById('replyPreview');
        if (replyPreview) replyPreview.style.display = 'none';
    };
    
    // ==================== УДАЛЕНИЕ/РЕДАКТИРОВАНИЕ ====================
    
    window.deleteMessage = async function(messageId) {
        if (!contextMessageIsMine) { showToast('Нельзя удалять чужие сообщения', 'error'); return; }
        if (!confirm('Удалить это сообщение?')) return;
        try {
            const res = await fetch(`/api/messages/${messageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Ошибка удаления');
            
            const messageEl = document.getElementById(`message-${messageId}`);
            if (messageEl) {
                const isMine = messageEl.classList.contains('message-mine');
                const timeEl = messageEl.querySelector('.message-time');
                const timeStr = timeEl ? timeEl.textContent : '';
                messageEl.innerHTML = `
                    <div class="message-bubble deleted-message">
                        <div class="message-content">
                            <span class="message-text" style="font-style: italic; opacity: 0.6;">Сообщение удалено</span>
                        </div>
                        ${timeStr ? `<span class="message-time">${timeStr}</span>` : ''}
                    </div>
                `;
            }
        } catch (err) {
            showToast('Ошибка: ' + err.message, 'error');
        }
    };
    
    window.editMessage = function(messageId, currentText) {
        if (!messageId || isNaN(messageId)) { showToast('Ошибка: неверный ID сообщения', 'error'); return; }
        editingMessageId = parseInt(messageId);
        const editTextarea = document.getElementById('editMessageText');
        if (editTextarea) editTextarea.value = currentText;
        const modalEl = document.getElementById('editMessageModal');
        if (modalEl) new bootstrap.Modal(modalEl).show();
    };
    
    // ==================== ПЕРЕСЫЛКА ====================
    
    async function showForwardModal() {
        try {
            const res = await fetch('/api/contacts', { headers: { 'Authorization': `Bearer ${token}` } });
            const contacts = await res.json();
            const list = document.getElementById('forwardContactsList');
            if (!list) return;
            
            if (!contacts || contacts.length === 0) {
                list.innerHTML = '<div class="list-group-item text-muted text-center py-3 small">Нет контактов</div>';
            } else {
                list.innerHTML = contacts.map(c => `
                    <button class="list-group-item list-group-item-action py-2 px-3" onclick="forwardToContact('${c.username.replace(/'/g, "\\'")}', ${c.id})">
                        <span>${escapeHtml(c.username)}</span>
                    </button>
                `).join('');
            }
            const modalEl = document.getElementById('forwardModal');
            if (modalEl) new bootstrap.Modal(modalEl).show();
        } catch (err) {
            showToast('Ошибка загрузки контактов', 'error');
        }
    }
    
    window.forwardToContact = async function(username, friendId) {
        if (!contextMessageId) { showToast('Нет сообщения для пересылки', 'error'); return; }
        try {
            const res = await fetch(`/api/messages/${contextMessageId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Сообщение не найдено');
            const message = await res.json();
            
            const originalSenderName = message.fromUser || 'Неизвестно';
            const originalText = message.messageText || '';
            const originalSenderLastName = message.fromLastName || '';
            const hasFile = message.filePath && message.filePath.trim();
            
            if (hasFile) {
                const formData = new FormData();
                formData.append('to', username);
                formData.append('text', originalText);
                formData.append('forwardedMessageId', contextMessageId);
                formData.append('forwardSenderName', originalSenderName);
                formData.append('forwardSenderLastName', originalSenderLastName);
                formData.append('forwardOriginalText', originalText);
                
                const fileRes = await fetch(message.filePath);
                const fileBlob = await fileRes.blob();
                const fileName = message.filePath.split('/').pop() || 'file';
                formData.append('files[]', fileBlob, fileName);
                
                const forwardRes = await fetch('/api/message/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (!forwardRes.ok) throw new Error('Ошибка пересылки');
            } else {
                const forwardRes = await fetch('/api/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        to: username,
                        text: originalText,
                        forwardedMessageId: contextMessageId,
                        forwardSenderName: originalSenderName,
                        forwardSenderLastName: originalSenderLastName,
                        forwardOriginalText: originalText
                    })
                });
                if (!forwardRes.ok) throw new Error('Ошибка пересылки');
            }
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('forwardModal'));
            if (modal) modal.hide();
            if (currentChatIdentifier) await loadMessages(currentChatIdentifier);
            showToast('Сообщение переслано', 'success');
            contextMessageId = null;
        } catch (err) {
            showToast('Ошибка пересылки: ' + err.message, 'error');
        }
    };
    
    // ==================== УВЕДОМЛЕНИЯ ====================
    
    async function checkNotifications() {
        try {
            const res = await fetch('/api/friend-requests/count', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            const badge = document.getElementById('notifBadge');
            if (badge) {
                badge.style.display = data.count > 0 ? 'inline' : 'none';
                if (data.count > 0) badge.textContent = data.count;
            }
        } catch (err) {}
    }
    
    // ==================== ПРОКРУТКА К СООБЩЕНИЮ ====================
    
    window.scrollToMessage = function(messageId) {
        if (!messageId) { showToast('Ошибка: ID сообщения не указан', 'error'); return; }
        const messageEl = document.getElementById(`message-${messageId}`);
        if (!messageEl) { showToast('Сообщение не найдено', 'error'); return; }
        
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageEl.style.transition = 'background 0.3s ease';
        
        const target = messageEl.querySelector('.message-bubble') || messageEl.querySelector('.message-file-container');
        if (target) {
            target.style.background = 'rgba(59, 130, 246, 0.2)';
            setTimeout(() => { target.style.background = ''; }, 2000);
        }
    };
    
    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    
    loadMyAvatar();
    loadContacts();
    setupSendButton();
    
    // Обработчики событий
    const messageTextInput = document.getElementById('messageText');
    if (messageTextInput) {
        messageTextInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('sendBtn')?.click(); });
        messageTextInput.addEventListener('input', () => { if (currentFriendId) saveDraft(currentFriendId); });
    }
    
    // Добавление друга
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (addFriendBtn) {
        addFriendBtn.onclick = async () => {
            const identifier = document.getElementById('newContactInput')?.value.trim();
            const errorDiv = document.getElementById('addContactError');
            const successDiv = document.getElementById('addContactSuccess');
            
            if (!identifier) { if (errorDiv) { errorDiv.textContent = 'Введите email друга'; errorDiv.style.display = 'block'; } return; }
            
            try {
                const res = await fetch('/api/contacts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ username: identifier })
                });
                const result = await res.json();
                
                if (res.ok) {
                    if (errorDiv) errorDiv.style.display = 'none';
                    if (successDiv) { successDiv.textContent = result.message; successDiv.style.display = 'block'; }
                    document.getElementById('newContactInput').value = '';
                    loadContacts();
                    checkNotifications();
                    setTimeout(() => { if (successDiv) successDiv.style.display = 'none'; }, 3000);
                } else {
                    if (errorDiv) { errorDiv.textContent = result.error; errorDiv.style.display = 'block'; }
                }
            } catch (err) {
                if (errorDiv) { errorDiv.textContent = 'Ошибка: ' + err.message; errorDiv.style.display = 'block'; }
            }
        };
    }
    
    const newContactInput = document.getElementById('newContactInput');
    if (newContactInput) {
        newContactInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addFriendBtn?.click(); });
    }
    
    // Выход
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = () => { localStorage.clear(); window.location.href = 'login.html'; };
    }
    
    // Прикрепление файлов
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            selectedFiles = Array.from(e.target.files);
            if (selectedFiles.length > 0) {
                await sendFiles();
                selectedFiles = [];
                fileInput.value = '';
            }
        });
    }
    
    // Голосовые сообщения
    const voiceBtn = document.getElementById('voiceBtn');
    const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');
    const sendVoiceBtn = document.getElementById('sendVoiceBtn');
    
    if (voiceBtn) voiceBtn.addEventListener('click', () => { if (!mediaRecorder || mediaRecorder.state === 'inactive') startVoiceRecording(); });
    if (cancelVoiceBtn) cancelVoiceBtn.addEventListener('click', cancelVoiceRecording);
    if (sendVoiceBtn) sendVoiceBtn.addEventListener('click', sendVoiceMessage);
    
    // Закрытие контекстного меню
    document.addEventListener('click', function(e) {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu && !e.target.closest('#contextMenu')) contextMenu.style.display = 'none';
    });
    document.addEventListener('scroll', function() {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) contextMenu.style.display = 'none';
    });
    
    // Сохранение редактирования
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
        saveEditBtn.onclick = async () => {
            const newText = document.getElementById('editMessageText')?.value.trim();
            if (!newText) { showToast('Сообщение не может быть пустым', 'error'); return; }
            if (!editingMessageId) { showToast('Ошибка: ID сообщения не задан', 'error'); return; }
            
            try {
                const res = await fetch(`/api/messages/${editingMessageId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ text: newText })
                });
                if (!res.ok) throw new Error('Ошибка редактирования');
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('editMessageModal'));
                if (modal) modal.hide();
                
                const messageEl = document.getElementById(`message-${editingMessageId}`);
                if (messageEl) {
                    const textEl = messageEl.querySelector('.message-text');
                    if (textEl) textEl.innerHTML = linkifyText(escapeHtml(newText));
                }
                editingMessageId = null;
            } catch (err) {
                showToast('Ошибка: ' + err.message, 'error');
            }
        };
    }
    
    window.showFriendProfileSidebar = function() {
        if (currentFriendId) loadFriendProfileSidebar(currentFriendId);
    };
    
    // Long press для мобильных устройств
    const messagesAreaTouch = document.getElementById('messagesArea');
    if (messagesAreaTouch) {
        let longPressTimer = null;
        let touchStartX = 0, touchStartY = 0;
        const LONG_PRESS_DURATION = 800;
        const TOUCH_MOVE_THRESHOLD = 10;
        
        messagesAreaTouch.addEventListener('touchstart', function(e) {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            const target = e.target.closest('.message-bubble, .message-file-container');
            if (!target) return;
            
            const messageEl = target.closest('.message');
            if (!messageEl) return;
            const deletedText = messageEl.querySelector('.message-text');
            if (deletedText && deletedText.textContent === 'Сообщение удалено') return;
            
            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                const messageId = parseInt(messageEl.id.replace('message-', ''));
                if (isNaN(messageId)) return;
                const isMine = messageEl.classList.contains('message-mine');
                const textEl = target.querySelector('.message-text');
                const voicePlayer = target.querySelector('.voice-player');
                const fileEl = voicePlayer || target.querySelector('audio') || target.querySelector('.message-attachment');
                const messageText = textEl ? textEl.textContent : '';
                const messageFile = fileEl ? (fileEl.getAttribute('data-src') || fileEl.src || fileEl.getAttribute('href') || '') : '';
                const fakeEvent = { preventDefault: () => {}, stopPropagation: () => {}, pageX: touchStartX, pageY: touchStartY, type: 'touch' };
                showContextMenu(fakeEvent, messageId, messageText, messageFile, isMine);
            }, LONG_PRESS_DURATION);
        });
        
        messagesAreaTouch.addEventListener('touchmove', function(e) {
            if (!longPressTimer) return;
            const touch = e.touches[0];
            const dx = Math.abs(touch.clientX - touchStartX);
            const dy = Math.abs(touch.clientY - touchStartY);
            if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) { clearTimeout(longPressTimer); longPressTimer = null; }
        });
        
        messagesAreaTouch.addEventListener('touchend', () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
        messagesAreaTouch.addEventListener('contextmenu', (e) => { if (e.target.closest('.message-bubble, .message-file-container')) e.preventDefault(); });
    }
    
    // Плеер голосовых сообщений
    const messagesAreaPlayer = document.getElementById('messagesArea');
    if (messagesAreaPlayer) {
        messagesAreaPlayer.addEventListener('click', function(e) {
            const btn = e.target.closest('.voice-play-btn');
            if (!btn) return;
            e.stopPropagation();
            
            const player = btn.closest('.voice-player');
            if (!player) return;
            const audio = player.querySelector('audio');
            if (!audio) return;
            
            // Останавливаем остальные
            document.querySelectorAll('.voice-player audio').forEach(a => {
                if (a !== audio && !a.paused) {
                    a.pause();
                    a.currentTime = 0;
                    const otherPlayer = a.closest('.voice-player');
                    if (otherPlayer) {
                        const otherBtn = otherPlayer.querySelector('.voice-play-btn');
                        const otherBar = otherPlayer.querySelector('.voice-progress-bar');
                        if (otherBtn) otherBtn.textContent = '▶';
                        if (otherBar) otherBar.style.width = '0%';
                    }
                }
            });
            
            const bar = player.querySelector('.voice-progress-bar');
            
            if (audio.paused) { audio.play(); btn.textContent = '⏸'; }
            else { audio.pause(); btn.textContent = '▶'; }
            
            audio.ontimeupdate = () => {
                if (audio.duration) {
                    const pct = (audio.currentTime / audio.duration) * 100;
                    if (bar) bar.style.width = pct + '%';
                }
            };
            audio.onended = () => { btn.textContent = '▶'; if (bar) bar.style.width = '0%'; audio.currentTime = 0; };
        });
        
        // Перемотка по прогресс-бару
        messagesAreaPlayer.addEventListener('click', function(e) {
            const wrap = e.target.closest('.voice-progress-wrap');
            if (!wrap) return;
            e.stopPropagation();
            
            const player = wrap.closest('.voice-player');
            if (!player) return;
            const audio = player.querySelector('audio');
            if (!audio || !audio.duration) return;
            
            const rect = wrap.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, x / rect.width));
            audio.currentTime = pct * audio.duration;
            const bar = player.querySelector('.voice-progress-bar');
            if (bar) bar.style.width = (pct * 100) + '%';
        });
    }
    
    checkNotifications();
    refreshUnreadCounts();
    setInterval(checkNotifications, 30000);
    setInterval(refreshUnreadCounts, 15000);
});