document.addEventListener('DOMContentLoaded', function() {
    
    // Получаем токен
    let token = localStorage.getItem('token');
    const myUserId = localStorage.getItem('myUserId');
    const myPhone = localStorage.getItem('myPhone');
const myEmail = localStorage.getItem('myEmail');
    const loginMethod = myPhone ? 'phone' : (myEmail ? 'email' : null);

    // Проверяем авторизацию
    if (!token || !myUserId) {
        window.location.href = 'login.html';
        return;
    }

    const defaultAvatar = '/uploads/avatars/default-avatar.svg';
    let profileData = {};

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
    function showToast(message, type = 'info') {
        showNotificationModal(message, type);
    }

    // Сохранение профиля
    function applyTheme(isDark) {
        const body = document.body;
        const themeBadge = document.getElementById('themeBadge');
        const toggleThemeSpan = document.querySelector('#toggleThemeBtn span:first-child');
        
        if (!body) return;
        
        if (isDark) {
            body.classList.add('dark-theme');
            if (themeBadge) {
                themeBadge.textContent = 'ВКЛ';
                themeBadge.className = 'badge bg-success';
            }
            if (toggleThemeSpan) toggleThemeSpan.textContent = 'Светлая тема';
        } else {
            body.classList.remove('dark-theme');
            if (themeBadge) {
                themeBadge.textContent = 'ВЫКЛ';
                themeBadge.className = 'badge bg-primary';
            }
            if (toggleThemeSpan) toggleThemeSpan.textContent = 'Тёмная тема';
        }
    }
    const savedTheme = localStorage.getItem('darkTheme');
    applyTheme(savedTheme === 'true');
    const toggleThemeBtn = document.getElementById('toggleThemeBtn');
    if (toggleThemeBtn) {
        toggleThemeBtn.onclick = () => {
            const isDark = !document.body.classList.contains('dark-theme');
            applyTheme(isDark);
            localStorage.setItem('darkTheme', isDark ? 'true' : 'false');
        };
    }

    // Форматирования статуса
    function formatOnlineStatus(lastSeen) {
        if (!lastSeen) return 'Неизвестно';
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffMs = now - lastSeenDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'В сети';
        if (diffMins < 60) return `${diffMins} мин. назад`;
        if (diffHours < 24) return `${diffHours} ч. назад`;
        if (diffDays < 7) return `${diffDays} дн. назад`;
        return lastSeenDate.toLocaleDateString('ru-RU');
    }

// Загрузка профиля
    async function loadProfile() {
        try {
            const res = await fetch('/api/profile/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.status === 401) {
                localStorage.clear();
                window.location.href = 'login.html';
                return;
            }
            
            if (!res.ok) {
                throw new Error('Ошибка при загрузке профиля');
}
            
            profileData = await res.json();
            
            const profileNameEl = document.getElementById('profileName');
            if (profileNameEl) {
                const fullName = (profileData.displayName || '') + ' ' + (profileData.lastName || '');
                profileNameEl.textContent = fullName.trim() || 'Без имени';
            }
            
            const displayNameInput = document.getElementById('displayName');
            if (displayNameInput) displayNameInput.value = profileData.displayName || '';
            
            const lastNameInput = document.getElementById('lastName');
            if (lastNameInput) lastNameInput.value = profileData.lastName || '';
            
            const bioInput = document.getElementById('bio');
            if (bioInput) bioInput.value = profileData.bio || '';
            
            // Отображение телефона с учетом скрытия
            const phoneDisplay = document.getElementById('phoneDisplay');
            if (phoneDisplay) {
                if (profileData.phone) {
                    phoneDisplay.value = profileData.hidePhone ? 'Скрыт' : profileData.phone;
                } else {
                    phoneDisplay.value = 'Не указан';
                }
            }
            
            // Отображение email с учетом скрытия
            const emailDisplay = document.getElementById('emailDisplay');
            if (emailDisplay) {
                if (profileData.email) {
                    emailDisplay.value = profileData.hideEmail ? 'Скрыт' : profileData.email;
                } else {
                    emailDisplay.value = 'Не указан';
                }
            }
            
            // Скрываем ненужные поля в зависимости от способа входа
            if (loginMethod === 'phone') {
                const emailField = document.getElementById('emailDisplay')?.closest('.info-field');
                if (emailField) emailField.style.display = 'none';
            } else if (loginMethod === 'email') {
                const phoneField = document.getElementById('phoneDisplay')?.closest('.info-field');
                if (phoneField) phoneField.style.display = 'none';
            }         
            const hidePhoneBtn = document.getElementById('hidePhoneBtn');
            const hideEmailBtn = document.getElementById('hideEmailBtn');
            
            // Функция для обновления состояния кнопок
            function updatePrivacyButtons(phone, email) {
                if (hidePhoneBtn) {
                    if (phone) {
                        hidePhoneBtn.classList.toggle('active', profileData.hidePhone === true);
                        hidePhoneBtn.disabled = false;
                        const btnText = hidePhoneBtn.querySelector('.btn-text');
                        if (btnText) {
                            btnText.textContent = profileData.hidePhone ? 'ВКЛ' : 'ВЫКЛ';
                        }
                    } else {
                        hidePhoneBtn.classList.remove('active');
                        hidePhoneBtn.disabled = true;
                        const btnText = hidePhoneBtn.querySelector('.btn-text');
                        if (btnText) {
                            btnText.textContent = 'Нет номера';
                        }
                    }
                }
                
                if (hideEmailBtn) {
                    if (email) {
                        hideEmailBtn.classList.toggle('active', profileData.hideEmail === true);
                        hideEmailBtn.disabled = false;
                        const btnText = hideEmailBtn.querySelector('.btn-text');
                        if (btnText) {
                            btnText.textContent = profileData.hideEmail ? 'ВКЛ' : 'ВЫКЛ';
                        }
                    } else {
                        hideEmailBtn.classList.remove('active');
                        hideEmailBtn.disabled = true;
                        const btnText = hideEmailBtn.querySelector('.btn-text');
                        if (btnText) {
                            btnText.textContent = 'Нет email';
                        }
                    }
                }
            }     
            updatePrivacyButtons(profileData.phone, profileData.email);
            
            // Скрываем ненужные настройки приватности
            if (loginMethod === 'phone') {
                const hideEmailSetting = document.getElementById('hideEmailBtn')?.closest('.setting-item');
                if (hideEmailSetting) hideEmailSetting.style.display = 'none';
            } else if (loginMethod === 'email') {
                const hidePhoneSetting = document.getElementById('hidePhoneBtn')?.closest('.setting-item');
                if (hidePhoneSetting) hidePhoneSetting.style.display = 'none';
            }
            
            // Обработчики для кнопок переключения приватности
            if (hidePhoneBtn) {
                hidePhoneBtn.addEventListener('click', () => {
                    if (!profileData.phone) return;
                    profileData.hidePhone = !profileData.hidePhone;
                    const btnText = hidePhoneBtn.querySelector('.btn-text');
                    if (btnText) {
                        btnText.textContent = profileData.hidePhone ? 'ВКЛ' : 'ВЫКЛ';
                    }
                    hidePhoneBtn.classList.toggle('active', profileData.hidePhone);
                });
            }
            
            if (hideEmailBtn) {
                hideEmailBtn.addEventListener('click', () => {
                    if (!profileData.email) return;
                    profileData.hideEmail = !profileData.hideEmail;
                    const btnText = hideEmailBtn.querySelector('.btn-text');
                    if (btnText) {
                        btnText.textContent = profileData.hideEmail ? 'ВКЛ' : 'ВЫКЛ';
                    }
                    hideEmailBtn.classList.toggle('active', profileData.hideEmail);
                });
            }
            
            // Дата регистрации
            const createdAtDisplay = document.getElementById('createdAtDisplay');
            if (createdAtDisplay && profileData.createdAt) {
                createdAtDisplay.value = new Date(profileData.createdAt).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            
            // Аватар
const avatarPreview = document.getElementById('avatarPreview');
            if (avatarPreview) {
                avatarPreview.onerror = () => {
                    avatarPreview.src = defaultAvatar;
                    avatarPreview.onerror = null;
                };
                avatarPreview.src = profileData.avatarUrl || defaultAvatar;
            }
            
            // Статус онлайн
            const onlineStatusEl = document.getElementById('onlineStatus');
            if (onlineStatusEl && profileData.lastSeen) {
                onlineStatusEl.textContent = formatOnlineStatus(profileData.lastSeen);
            }
            
            // Уведомление для новых пользователей
            const newUserAlert = document.getElementById('newUserAlert');
            if (newUserAlert && !profileData.displayName) {
                newUserAlert.style.display = 'block';
            }
        } catch (err) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger m-3';
            errorDiv.innerHTML = `Ошибка загрузки профиля: ${err.message}<br><button onclick="location.reload()" class="btn btn-sm btn-danger mt-2">Обновить</button>`;
            const container = document.querySelector('.container');
            if (container) container.prepend(errorDiv);
        }
    }

    // Сохранение профиля
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
            let displayName = document.getElementById('displayName').value.trim();
            let lastName = document.getElementById('lastName').value.trim();
            const bio = document.getElementById('bio').value.trim();
            const hidePhone = loginMethod === 'phone' ? (profileData.hidePhone || false) : false;
            const hideEmail = loginMethod === 'email' ? (profileData.hideEmail || false) : false;
            
            // Валидация
            if (!displayName) {
                showToast('Введите имя', 'error');
                return;
            }
            
            if (displayName.length < 3) {
                showToast('Имя должно содержать минимум 3 символа', 'error');
                return;
            }
            
            if (displayName.length > 60) {
                showToast('Имя не должно превышать 60 символов', 'error');
                return;
            }
            
            const namePattern = /^[a-zA-Zа-яА-ЯёЁ]+$/;
            if (!namePattern.test(displayName)) {
                showToast('В имени могут быть только буквы', 'error');
                return;
            }
            
            if (!lastName) {
                showToast('Введите фамилию', 'error');
                return;
            }
            
            if (lastName.length < 3) {
                showToast('Фамилия должна содержать минимум 3 символа', 'error');
                return;
            }
            
            if (lastName.length > 60) {
                showNotificationModal('Фамилия не должна превышать 60 символов', 'warning');
                return;
            }
            
            if (!namePattern.test(lastName)) {
                showNotificationModal('В фамилии могут быть только буквы', 'warning');
                return;
            }
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
            lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
            token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/profile/me', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        displayName, 
                        lastName, 
                        bio, 
                        hidePhone, 
                        hideEmail 
                    })
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    const profileNameEl = document.getElementById('profileName');
                    if (profileNameEl) {
                        profileNameEl.textContent = displayName + ' ' + lastName;
                    }
                    
                    profileData.displayName = displayName;
                    profileData.lastName = lastName;
                    profileData.bio = bio;
                    profileData.hidePhone = loginMethod === 'phone' ? hidePhone : false;
                    profileData.hideEmail = loginMethod === 'email' ? hideEmail : false;
                    
                    const phoneDisplay = document.getElementById('phoneDisplay');
                    if (phoneDisplay && profileData.phone && loginMethod === 'phone') {
                        phoneDisplay.value = hidePhone ? 'Скрыт' : profileData.phone;
                    }
                    
                    const emailDisplay = document.getElementById('emailDisplay');
                    if (emailDisplay && profileData.email && loginMethod === 'email') {
                        emailDisplay.value = hideEmail ? 'Скрыт' : profileData.email;
                    }
                    
                    showNotificationModal('Профиль обновлён!', 'success');
                    
                    // Если это новый пользователь, перенаправляем в чат
                    const newUserAlert = document.getElementById('newUserAlert');
                    if (newUserAlert && newUserAlert.style.display !== 'none') {
                        newUserAlert.style.display = 'none';
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 1000);
                    }
                } else {
                    showNotificationModal('Ошибка: ' + (result.error || 'Неизвестная ошибка'), 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка сохранения: ' + err.message, 'error');
            }
        };
    }

    // Загрузка аватара
    let selectedAvatarFile = null;

    function updateSelectedAvatarUI(file) {
        const selectedAvatarInfo = document.getElementById('selectedAvatarInfo');
        const selectedAvatarPreview = document.getElementById('selectedAvatarPreview');

        if (selectedAvatarInfo) {
            if (file) {
                selectedAvatarInfo.innerHTML = `<span class="text-success">&#10003;</span> <span>${file.name}</span>`;
            } else {
                selectedAvatarInfo.innerHTML = `<span class="text-muted">Файл не выбран</span>`;
            }
        }

        if (selectedAvatarPreview) {
            if (file) {
                selectedAvatarPreview.src = URL.createObjectURL(file);
                selectedAvatarPreview.style.display = 'block';
            } else {
                selectedAvatarPreview.src = '';
                selectedAvatarPreview.style.display = 'none';
            }
        }
    }

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.onchange = (e) => {
            if (e.target.files[0]) {
                selectedAvatarFile = e.target.files[0];
                updateSelectedAvatarUI(selectedAvatarFile);
                const modal = new bootstrap.Modal(document.getElementById('uploadModal'));
                modal.show();
            }
        };
    }

    // Сброс состояния
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
        uploadModal.addEventListener('hidden.bs.modal', () => {
            selectedAvatarFile = null;
            updateSelectedAvatarUI(null);
            if (avatarInput) avatarInput.value = '';
        });
    }

    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.onclick = () => {
            selectedAvatarFile = null;
            updateSelectedAvatarUI(null);
            if (avatarInput) {
                avatarInput.value = '';
                avatarInput.click();
            }
        };
    }

    // Принудительная очистка 
    function cleanupModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.removeAttribute('aria-modal');
        modalEl.setAttribute('aria-hidden', 'true');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
    let isUploadingAvatar = false;
    if (uploadAvatarBtn) {
        uploadAvatarBtn.onclick = async () => {
            if (isUploadingAvatar) return;
            isUploadingAvatar = true;
            uploadAvatarBtn.disabled = true;

            const file = selectedAvatarFile;
            
            if (!file) {
                showNotificationModal('Выберите файл', 'warning');
                isUploadingAvatar = false;
                uploadAvatarBtn.disabled = false;
                return;
            }
            
            const formData = new FormData();
            formData.append('avatar', file);
            
            try {
                const uploadProgress = document.getElementById('uploadProgress');
                if (uploadProgress) uploadProgress.style.display = 'flex';
                
                token = localStorage.getItem('token');
                const res = await fetch('/api/profile/avatar', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                let result;
                try {
                    result = await res.json();
                } catch (parseErr) {
                    throw new Error('Сервер вернул неверный ответ. Возможно, файл слишком большой или формат не поддерживается.');
                }
                
                if (result.success) {
                    const avatarPreview = document.getElementById('avatarPreview');
                    if (avatarPreview) avatarPreview.src = result.avatarUrl + '?t=' + Date.now();
                    
                    const modalEl = document.getElementById('uploadModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                    cleanupModal(modalEl);
                    
                    selectedAvatarFile = null;
                    updateSelectedAvatarUI(null);
                    if (avatarInput) avatarInput.value = '';
                    
                    showNotificationModal('Аватар загружен', 'success');
                } else {
                    showNotificationModal('Ошибка: ' + result.error, 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка загрузки: ' + err.message, 'error');
            } finally {
                const uploadProgress = document.getElementById('uploadProgress');
                if (uploadProgress) uploadProgress.style.display = 'none';
                isUploadingAvatar = false;
                uploadAvatarBtn.disabled = false;
            }
        };
    }

    // Выход
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.clear();
            window.location.href = 'login.html';
        };
    }

    // Удаление аккаунта
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = () => {
            if (confirm('Вы уверены? Это действие необратимо!')) {
                showNotificationModal('Функция в разработке', 'info');
            }
        };
    }

    // Редактирование номера
    let editPhoneModal = null;
    let currentPhone = '';
    let tempPhone = '';
    let oldPhoneVerified = false;

    const editPhoneBtn = document.getElementById('editPhoneBtn');
    if (editPhoneBtn) {
        editPhoneBtn.onclick = async () => {
            currentPhone = profileData.phone || '';
            const currentPhoneDisplay = document.getElementById('currentPhoneDisplay');
            if (currentPhoneDisplay) currentPhoneDisplay.textContent = currentPhone || 'Не указан';
            
            const phoneCurrentStep = document.getElementById('phoneCurrentStep');
            const phoneOldCodeStep = document.getElementById('phoneOldCodeStep');
            const phoneNewStep = document.getElementById('phoneNewStep');
            const phoneNewCodeStep = document.getElementById('phoneNewCodeStep');
            
            if (phoneCurrentStep) phoneCurrentStep.style.display = 'block';
            if (phoneOldCodeStep) phoneOldCodeStep.style.display = 'none';
            if (phoneNewStep) phoneNewStep.style.display = 'none';
            if (phoneNewCodeStep) phoneNewCodeStep.style.display = 'none';
            oldPhoneVerified = false;
            
            editPhoneModal = new bootstrap.Modal(document.getElementById('editPhoneModal'));
            editPhoneModal.show();
        };
    }

    // Подтвердить старый номер
    const requestOldPhoneCodeBtn = document.getElementById('requestOldPhoneCodeBtn');
    if (requestOldPhoneCodeBtn) {
        requestOldPhoneCodeBtn.onclick = async () => {
            if (!currentPhone) {
                const phoneCurrentStep = document.getElementById('phoneCurrentStep');
                const phoneNewStep = document.getElementById('phoneNewStep');
                if (phoneCurrentStep) phoneCurrentStep.style.display = 'none';
                if (phoneNewStep) phoneNewStep.style.display = 'block';
                oldPhoneVerified = true;
                return;
            }
            
            try {
                const res = await fetch('/api/request-phone-change-code', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const data = await res.json();
                
                if (data.success) {
                    const phoneCurrentStep = document.getElementById('phoneCurrentStep');
                    const phoneOldCodeStep = document.getElementById('phoneOldCodeStep');
                    if (phoneCurrentStep) phoneCurrentStep.style.display = 'none';
                    if (phoneOldCodeStep) phoneOldCodeStep.style.display = 'block';
                    const oldPhoneCode = document.getElementById('oldPhoneCode');
                    if (oldPhoneCode) oldPhoneCode.focus();
                } else {
                    showNotificationModal('Ошибка: ' + data.error, 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка отправки кода: ' + err.message, 'error');
            }
        };
    }

    // Пропустить подтверждение
    const skipOldPhoneBtn = document.getElementById('skipOldPhoneBtn');
    if (skipOldPhoneBtn) {
        skipOldPhoneBtn.onclick = () => {
            const phoneCurrentStep = document.getElementById('phoneCurrentStep');
            const phoneNewStep = document.getElementById('phoneNewStep');
            if (phoneCurrentStep) phoneCurrentStep.style.display = 'none';
            if (phoneNewStep) phoneNewStep.style.display = 'block';
            oldPhoneVerified = true;
        };
    }

    // Редактирование email
    let editEmailModal = null;
    let currentEmail = '';
    let tempEmail = '';
    let oldEmailVerified = false;

    const editEmailBtn = document.getElementById('editEmailBtn');
    if (editEmailBtn) {
        editEmailBtn.onclick = async () => {
            currentEmail = profileData.email || '';
            const currentEmailDisplay = document.getElementById('currentEmailDisplay');
            if (currentEmailDisplay) currentEmailDisplay.textContent = currentEmail || 'Не указан';
            
            const emailCurrentStep = document.getElementById('emailCurrentStep');
            const emailOldCodeStep = document.getElementById('emailOldCodeStep');
            const emailNewStep = document.getElementById('emailNewStep');
            const emailNewCodeStep = document.getElementById('emailNewCodeStep');
            
            if (emailCurrentStep) emailCurrentStep.style.display = 'block';
            if (emailOldCodeStep) emailOldCodeStep.style.display = 'none';
            if (emailNewStep) emailNewStep.style.display = 'none';
            if (emailNewCodeStep) emailNewCodeStep.style.display = 'none';
            oldEmailVerified = false;
            
            editEmailModal = new bootstrap.Modal(document.getElementById('editEmailModal'));
            editEmailModal.show();
        };
    }

    // Подтвердить старый email
    const requestOldEmailCodeBtn = document.getElementById('requestOldEmailCodeBtn');
    if (requestOldEmailCodeBtn) {
        requestOldEmailCodeBtn.onclick = async () => {
            token = localStorage.getItem('token');
            if (!currentEmail) {
                const emailCurrentStep = document.getElementById('emailCurrentStep');
                const emailNewStep = document.getElementById('emailNewStep');
                if (emailCurrentStep) emailCurrentStep.style.display = 'none';
                if (emailNewStep) emailNewStep.style.display = 'block';
                oldEmailVerified = true;
                return;
            }
            
            try {
                const res = await fetch('/api/request-email-change-code', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const data = await res.json();
                
                if (data.success) {
                    const emailCurrentStep = document.getElementById('emailCurrentStep');
                    const emailOldCodeStep = document.getElementById('emailOldCodeStep');
                    if (emailCurrentStep) emailCurrentStep.style.display = 'none';
                    if (emailOldCodeStep) emailOldCodeStep.style.display = 'block';
                    const oldEmailCode = document.getElementById('oldEmailCode');
                    if (oldEmailCode) oldEmailCode.focus();
                } else {
                    showNotificationModal('Ошибка: ' + data.error, 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка отправки кода: ' + err.message, 'error');
            }
        };
    }

    // Пропустить подтверждение старого email
    const skipOldEmailBtn = document.getElementById('skipOldEmailBtn');
    if (skipOldEmailBtn) {
        skipOldEmailBtn.onclick = () => {
            const emailCurrentStep = document.getElementById('emailCurrentStep');
            const emailNewStep = document.getElementById('emailNewStep');
            if (emailCurrentStep) emailCurrentStep.style.display = 'none';
            if (emailNewStep) emailNewStep.style.display = 'block';
            oldEmailVerified = true;
        };
    }

    // Проверить код со старого email
    const verifyOldEmailBtn = document.getElementById('verifyOldEmailBtn');
    if (verifyOldEmailBtn) {
        verifyOldEmailBtn.onclick = async () => {
            token = localStorage.getItem('token');
            const code = document.getElementById('oldEmailCode').value;
            
            try {
                const res = await fetch('/api/verify-old-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ code })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    const emailOldCodeStep = document.getElementById('emailOldCodeStep');
                    const emailNewStep = document.getElementById('emailNewStep');
                    if (emailOldCodeStep) emailOldCodeStep.style.display = 'none';
                    if (emailNewStep) emailNewStep.style.display = 'block';
                    oldEmailVerified = true;
                } else {
                    showNotificationModal('Ошибка: ' + data.error, 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка проверки кода: ' + err.message, 'error');
            }
        };
    }

    // Запросить код на новый email
    const requestNewEmailCodeBtn = document.getElementById('requestNewEmailCodeBtn');
    if (requestNewEmailCodeBtn) {
        requestNewEmailCodeBtn.onclick = async () => {
            token = localStorage.getItem('token');
            const newEmail = document.getElementById('newEmail').value;
            
            if (!newEmail || !newEmail.includes('@')) {
                showNotificationModal('Введите корректный email', 'warning');
                return;
            }
            
            tempEmail = newEmail;
            
            try {
                const res = await fetch('/api/request-email-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ email: newEmail })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    const emailNewStep = document.getElementById('emailNewStep');
                    const emailNewCodeStep = document.getElementById('emailNewCodeStep');
                    const newEmailDisplayModal = document.getElementById('newEmailDisplayModal');
                    if (emailNewStep) emailNewStep.style.display = 'none';
                    if (emailNewCodeStep) emailNewCodeStep.style.display = 'block';
                    if (newEmailDisplayModal) newEmailDisplayModal.textContent = newEmail;
                    const newEmailCode = document.getElementById('newEmailCode');
                    if (newEmailCode) newEmailCode.focus();
                } else {
                    showNotificationModal('Ошибка: ' + data.error, 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка отправки кода: ' + err.message, 'error');
            }
        };
    }

    // Проверить код с нового email и сохранить
    const verifyNewEmailBtn = document.getElementById('verifyNewEmailBtn');
    if (verifyNewEmailBtn) {
        verifyNewEmailBtn.onclick = async () => {
            token = localStorage.getItem('token');
            const code = document.getElementById('newEmailCode').value;
            
            try {
                const res = await fetch('/api/verify-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ email: tempEmail, code })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    if (editEmailModal) editEmailModal.hide();
                    showNotificationModal('Email успешно обновлён!', 'success');
                    
                    // Обновляем локальные данные и интерфейс
                    profileData.email = tempEmail;
                    const emailDisplay = document.getElementById('emailDisplay');
                    if (emailDisplay) emailDisplay.value = tempEmail;
                    
                    // Обновляем кнопку скрытия
                    const hideEmailBtn = document.getElementById('hideEmailBtn');
                    if (hideEmailBtn) {
                        hideEmailBtn.disabled = false;
                        const btnText = hideEmailBtn.querySelector('.btn-text');
                        if (btnText) btnText.textContent = 'ВЫКЛ';
                    }
                    
                    currentEmail = tempEmail;
                    tempEmail = '';
                } else {
                    showNotificationModal('Ошибка: ' + data.error, 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка проверки кода: ' + err.message, 'error');
            }
        };
    }

    // Отправить код повторно на новый email
    const resendNewEmailCodeBtn = document.getElementById('resendNewEmailCodeBtn');
    if (resendNewEmailCodeBtn) {
        resendNewEmailCodeBtn.onclick = async () => {
            token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/request-email-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ email: tempEmail })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    showNotificationModal('Код отправлен повторно', 'success');
                } else {
                    showNotificationModal('Ошибка: ' + data.error, 'error');
                }
            } catch (err) {
                showNotificationModal('Ошибка отправки кода: ' + err.message, 'error');
            }
        };
    }

loadProfile();
    
});