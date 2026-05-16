document.addEventListener('DOMContentLoaded', function() {
    
    const token = localStorage.getItem('token');
    const myUserId = localStorage.getItem('myUserId');
    const myEmail = localStorage.getItem('myEmail');
    const myPhone = localStorage.getItem('myPhone');
    const myIdentifier = myEmail || myPhone;
    
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo) {
        debugInfo.style.display = 'block';
        debugInfo.innerHTML = 'Токен: ' + (token ? 'есть' : 'нет') + '<br>Идентификатор пользователя: ' + (myUserId ? 'есть' : 'нет');
    }
    
    if (!token || !myUserId) {
        window.location.href = 'login.html';
        return;
    }
    
    if (myIdentifier) {
        const userIdentifierElement = document.getElementById('userIdentifier');
        if (userIdentifierElement) {
            userIdentifierElement.textContent = 'Аккаунт: ' + myIdentifier;
        }
    }
    
    async function checkProfile() {
        try {
            const res = await fetch('/api/profile/me', {
                headers: { 
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error('Ошибка HTTP ' + res.status);
            }
            
            const profile = await res.json();
            
            const isNewUser = !profile.displayName;
            
            const loadingElement = document.getElementById('loading');
            const newUserCard = document.getElementById('newUserCard');
            const existingUserCard = document.getElementById('existingUserCard');
            
            if (loadingElement) loadingElement.style.display = 'none';
            
            if (isNewUser) {
                if (newUserCard) newUserCard.style.display = 'block';
            } else {
                if (existingUserCard) {
                    existingUserCard.style.display = 'block';
                    const welcomeNameElement = document.getElementById('welcomeName');
                    if (welcomeNameElement) {
                        welcomeNameElement.textContent = profile.displayName + '!';
                    }
                }
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
            
        } catch (err) {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Ошибка!</strong><br>
                        ${err.message}<br><br>
                        <p class="small text-muted">Проверьте, что сервер запущен:<br>
                        <code>npm start</code><br>
                        и открыта страница <code>http://localhost:3000/check-profile.html</code></p>
                        <button onclick="window.location.href='login.html'" class="btn btn-primary">Вернуться ко входу</button>
                        <button onclick="location.reload()" class="btn btn-secondary">Обновить</button>
                    </div>
                `;
            }
        }
    }
    
    setTimeout(checkProfile, 100);
});