document.addEventListener('DOMContentLoaded', function() {
    
    const token = localStorage.getItem('token');
    const myUserId = localStorage.getItem('myUserId');

    // Аватарка по умолчанию
    const defaultAvatar = '/uploads/avatars/default-avatar.svg';

    if (!token || !myUserId) {
        window.location.href = 'login.html';
        return;
    }

    // Применяем сохранённую тему
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') {
        document.body.classList.add('dark-theme');
    }

    // Функция для показа модального окна с уведомлением
    function showNotificationModal(message, type = 'info') {
        const modalEl = document.getElementById('notificationModal');
        if (!modalEl) return;
        
        const titleEl = document.getElementById('notificationModalTitle');
        const messageEl = document.getElementById('notificationModalMessage');
        
        const titles = {
            success: 'Успешно',
            error: 'Ошибка',
            info: 'Информация',
            warning: 'Внимание'
        };
        
        if (titleEl) titleEl.textContent = titles[type] || titles.info;
        if (messageEl) messageEl.textContent = message;
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    // Загрузка входящих запросов
    async function loadIncomingRequests() {
        try {
            const res = await fetch('/api/friend-requests/incoming', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) {
                throw new Error('Ошибка загрузки запросов');
            }
            
            const requests = await res.json();
            const container = document.getElementById('incomingRequests');
            
            if (!container) return;
            
            if (requests.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p class="text-muted" style="font-size: 1.1rem; margin-bottom: 0;">Нет входящих запросов</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = requests.map(req => `
                <div class="card notification-card mb-2">
                    <div class="notification-content">
                        <img src="${req.avatarUrl || defaultAvatar}" 
                             alt="Аватар" class="avatar-small">
                        <div class="notification-info">
                            <div class="notification-name">${escapeHtml(req.senderName)}</div>
                            <div class="notification-meta">
                                ${req.phone || req.email || ''} • 
                                ${formatDate(req.createdAt)}
                            </div>
                        </div>
                        <div class="notification-actions">
                            <button class="btn btn-success btn-sm" onclick="window.acceptRequest(${req.id})">
                                Принять
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="window.declineRequest(${req.id})">
                                Отклонить
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            // Обновляем счётчик
            updateBadge(requests.length);
            
        } catch (err) {
            const container = document.getElementById('incomingRequests');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-danger">Ошибка загрузки: ${err.message}</div>
                `;
            }
        }
    }

    // Загрузка исходящих запросов
    async function loadOutgoingRequests() {
        try {
            const res = await fetch('/api/friend-requests/outgoing', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) {
                throw new Error('Ошибка загрузки запросов');
            }
            
            const requests = await res.json();
            const container = document.getElementById('outgoingRequests');
            
            if (!container) return;
            
            if (requests.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p class="text-muted" style="font-size: 1.1rem; margin-bottom: 0;">Нет исходящих запросов</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = requests.map(req => `
                <div class="card notification-card mb-2">
                    <div class="notification-content">
                        <img src="${req.avatarUrl || defaultAvatar}" 
                             alt="Аватар" class="avatar-small">
                        <div class="notification-info">
                            <div class="notification-name">${escapeHtml(req.receiverName)}</div>
                            <div class="notification-meta">
                                ${req.phone || req.email || ''} • 
                                ${formatDate(req.createdAt)}
                            </div>
                        </div>
                        <div class="notification-actions">
                            <span class="badge bg-warning text-dark mt-1">Ожидание</span>
                            <button class="btn btn-outline-danger btn-sm" onclick="window.cancelRequest(${req.id})">
                                Отменить
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
        } catch (err) {
            const container = document.getElementById('outgoingRequests');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-danger">Ошибка загрузки: ${err.message}</div>
                `;
            }
        }
    }

    // Форматирование даты
    function formatDate(dateString) {
        if (!dateString) return 'недавно';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин. назад`;
        if (diffHours < 24) return `${diffHours} ч. назад`;
        if (diffDays < 7) return `${diffDays} дн. назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }

    // Экранирование
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Принять запрос 
    window.acceptRequest = async function(requestId) {
        try {
            const res = await fetch(`/api/friend-requests/${requestId}/accept`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const result = await res.json();
            
            if (result.success) {
                loadIncomingRequests();
                loadOutgoingRequests();
                showNotificationModal('Пользователь добавлен в друзья!', 'success');
            } else {
                showNotificationModal('Ошибка: ' + result.error, 'error');
            }
        } catch (err) {
            showNotificationModal('Ошибка: ' + err.message, 'error');
        }
    };

    // Отклонить запрос
    window.declineRequest = async function(requestId) {
        if (!confirm('Отклонить этот запрос?')) return;
        
        try {
            const res = await fetch(`/api/friend-requests/${requestId}/decline`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const result = await res.json();
            
            if (result.success) {
                loadIncomingRequests();
                showNotificationModal('Запрос отклонён', 'success');
            } else {
                showNotificationModal('Ошибка: ' + result.error, 'error');
            }
        } catch (err) {
            showNotificationModal('Ошибка: ' + err.message, 'error');
        }
    };

    // Отменить запрос
    window.cancelRequest = async function(requestId) {
        if (!confirm('Отменить этот запрос?')) return;
        
        try {
            const res = await fetch(`/api/friend-requests/${requestId}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const result = await res.json();
            
            if (result.success) {
                loadOutgoingRequests();
                showNotificationModal('Запрос отменён', 'success');
            } else {
                showNotificationModal('Ошибка: ' + result.error, 'error');
            }
        } catch (err) {
            showNotificationModal('Ошибка: ' + err.message, 'error');
        }
    };

    // Обновление счётчика
    function updateBadge(count) {
        const badge = document.getElementById('notifBadge');
        if (badge) {
            if (count > 0) {
                badge.style.display = 'inline';
                badge.textContent = count;
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Выход
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.clear();
            window.location.href = 'login.html';
        };
    }

    // Переключение темы
    const toggleThemeBtn = document.getElementById('toggleThemeBtn');
    if (toggleThemeBtn) {
        toggleThemeBtn.onclick = () => {
            const body = document.body;
            const badge = document.getElementById('themeBadge');
            body.classList.toggle('dark-theme');
            const isDark = body.classList.contains('dark-theme');
            if (badge) {
                badge.textContent = isDark ? 'ВКЛ' : 'ВЫКЛ';
                badge.className = isDark ? 'badge bg-success' : 'badge bg-primary';
            }
            localStorage.setItem('darkTheme', isDark ? 'true' : 'false');
        };
    }
    loadIncomingRequests();
    loadOutgoingRequests();
    setInterval(() => {
        loadIncomingRequests();
        loadOutgoingRequests();
    }, 30000);
});