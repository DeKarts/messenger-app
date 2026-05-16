window.selectMethod = function(method) {
    var methodStep = document.getElementById('methodStep');
    var phoneStep = document.getElementById('phoneStep');
    var emailStep = document.getElementById('emailStep');
    var phoneCodeStep = document.getElementById('phoneCodeStep');
    var emailCodeStep = document.getElementById('emailCodeStep');
    
    if (methodStep) methodStep.style.display = 'none';
    if (phoneStep) phoneStep.style.display = 'none';
    if (emailStep) emailStep.style.display = 'none';
    if (phoneCodeStep) phoneCodeStep.style.display = 'none';
    if (emailCodeStep) emailCodeStep.style.display = 'none';
    
    if (method === 'phone') {
        if (phoneStep) phoneStep.style.display = 'block';
    } else {
        if (emailStep) emailStep.style.display = 'block';
    }
};

window.showMethodStep = function() {
    var methodStep = document.getElementById('methodStep');
    var phoneStep = document.getElementById('phoneStep');
    var emailStep = document.getElementById('emailStep');
    var phoneCodeStep = document.getElementById('phoneCodeStep');
    var emailCodeStep = document.getElementById('emailCodeStep');
    
    if (methodStep) methodStep.style.display = 'block';
    if (phoneStep) phoneStep.style.display = 'none';
    if (emailStep) emailStep.style.display = 'none';
    if (phoneCodeStep) phoneCodeStep.style.display = 'none';
    if (emailCodeStep) emailCodeStep.style.display = 'none';
};

if (typeof globalSavedTheme === 'undefined') {
    var globalSavedTheme = localStorage.getItem('darkTheme');
    if (globalSavedTheme === 'true') {
        document.body.classList.add('dark-theme');
    }
}

if (typeof currentPath === 'undefined') {
    var currentPath = window.location.pathname;
}

if (typeof token === 'undefined') {
    var token = localStorage.getItem('token');
    var myUserId = localStorage.getItem('myUserId');
    var myEmail = localStorage.getItem('myEmail');
    var myPhone = localStorage.getItem('myPhone');
    var myIdentifier = myEmail || myPhone;
}

if (document.getElementById('phoneForm') || document.getElementById('emailForm')) {

    var loginToggleThemeBtn = document.getElementById('toggleThemeBtn');

    function applyLoginTheme(isDark) {
        if (isDark) {
            document.body.style.setProperty('background', '#1a1a2e', 'important');
            document.body.style.setProperty('background-color', '#1a1a2e', 'important');
            document.body.style.setProperty('background-image', 'none', 'important');

            var themeBadge = document.getElementById('themeBadge');
            if (themeBadge) {
                themeBadge.textContent = 'ВКЛ';
                themeBadge.className = 'badge bg-success';
            }

            if (loginToggleThemeBtn) {
                var span = loginToggleThemeBtn.querySelector('span:first-child');
                if (span) span.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg> Светлая тема';
            }

            localStorage.setItem('darkTheme', 'true');
            document.body.classList.add('dark-theme');
        } else {
            document.body.style.removeProperty('background');
            document.body.style.removeProperty('background-color');
            document.body.style.removeProperty('background-image');

            var themeBadge = document.getElementById('themeBadge');
            if (themeBadge) {
                themeBadge.textContent = 'ВЫКЛ';
                themeBadge.className = 'badge bg-primary';
            }

            if (loginToggleThemeBtn) {
                var span = loginToggleThemeBtn.querySelector('span:first-child');
                if (span) span.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> Тёмная тема';
            }

            localStorage.setItem('darkTheme', 'false');
            document.body.classList.remove('dark-theme');
        }
    }

    var savedDarkTheme = localStorage.getItem('darkTheme');
    applyLoginTheme(savedDarkTheme === 'true');

    if (loginToggleThemeBtn) {
        loginToggleThemeBtn.onclick = function() {
            var isDark = localStorage.getItem('darkTheme') === 'true';
            applyLoginTheme(!isDark);
        };
    }

    var phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            var value = e.target.value.replace(/\D/g, '');
            if (value.startsWith('8')) {
                value = '7' + value.slice(1);
            }
            if (!value.startsWith('7') && value.length > 0) {
                value = '7' + value;
            }
            if (value.length > 11) {
                value = value.slice(0, 11);
            }
            
            if (value.length >= 1) {
                var formatted = '+' + value[0];
                if (value.length > 1) {
                    formatted += ' (' + value.slice(1, 4);
                }
                if (value.length > 4) {
                    formatted += ') ' + value.slice(4, 7);
                }
                if (value.length > 7) {
                    formatted += '-' + value.slice(7, 9);
                }
                if (value.length > 9) {
                    formatted += '-' + value.slice(9, 11);
                }
                e.target.value = formatted;
            }
        });
    }
    
    var currentPhone = '';
    var currentEmail = '';
    
    var phoneForm = document.getElementById('phoneForm');
    if (phoneForm) {
        phoneForm.onsubmit = async function(e) {
            e.preventDefault();
            var phone = document.getElementById('phone').value;
            var errorDiv = document.getElementById('phoneError');
            var submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Отправка...';
                if (errorDiv) errorDiv.innerText = '';
                
                var res = await fetch('/api/request-sms-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: phone })
                });
                
                var data = await res.json();
                
                if (data.success) {
                    currentPhone = phone;
                    var phoneDisplay = document.getElementById('phoneDisplay');
                    if (phoneDisplay) phoneDisplay.innerText = phone;
                    
                    var phoneStep = document.getElementById('phoneStep');
                    var phoneCodeStep = document.getElementById('phoneCodeStep');
                    if (phoneStep) phoneStep.style.display = 'none';
                    if (phoneCodeStep) phoneCodeStep.style.display = 'block';
                    
                    var phoneCode = document.getElementById('phoneCode');
                    if (phoneCode) phoneCode.focus();
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Код отправлен!';
                        setTimeout(function() {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки кода';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Получить код';
            }
        };
    }
    
    var emailForm = document.getElementById('emailForm');
    if (emailForm) {
        emailForm.onsubmit = async function(e) {
            e.preventDefault();
            var email = document.getElementById('email').value;
            var errorDiv = document.getElementById('emailError');
            var submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Отправка...';
                if (errorDiv) errorDiv.innerText = '';
                
                var res = await fetch('/api/request-email-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });
                
                var data = await res.json();
                
                if (data.success) {
                    currentEmail = email;
                    var emailDisplay = document.getElementById('emailDisplay');
                    if (emailDisplay) emailDisplay.innerText = email;
                    
                    var emailStep = document.getElementById('emailStep');
                    var emailCodeStep = document.getElementById('emailCodeStep');
                    if (emailStep) emailStep.style.display = 'none';
                    if (emailCodeStep) emailCodeStep.style.display = 'block';
                    
                    var emailCode = document.getElementById('emailCode');
                    if (emailCode) emailCode.focus();
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Код отправлен!';
                        setTimeout(function() {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки кода';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Получить код';
            }
        };
    }
    
    var phoneCodeForm = document.getElementById('phoneCodeForm');
    if (phoneCodeForm) {
        phoneCodeForm.onsubmit = async function(e) {
            e.preventDefault();
            var code = document.getElementById('phoneCode').value;
            var errorDiv = document.getElementById('phoneCodeError');
            var submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Вход...';
                
                var res = await fetch('/api/login-by-sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone, code: code })
                });
                
                var data = await res.json();
                
                if (data.success && data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('myPhone', data.user.phone);
                    localStorage.setItem('myUserId', data.user.id);
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Вход выполнен';
                    }
                    
                    setTimeout(function() {
                        window.location.href = 'check-profile.html';
                    }, 1500);
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка входа';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Войти';
            }
        };
    }
    
    var emailCodeForm = document.getElementById('emailCodeForm');
    if (emailCodeForm) {
        emailCodeForm.onsubmit = async function(e) {
            e.preventDefault();
            var code = document.getElementById('emailCode').value;
            var errorDiv = document.getElementById('emailCodeError');
            var submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Вход...';
                
                var res = await fetch('/api/login-by-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentEmail, code: code })
                });
                
                var data = await res.json();
                
                if (data.success && data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('myEmail', data.user.email);
                    localStorage.setItem('myUserId', data.user.id);
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Вход выполнен';
                    }
                    
                    setTimeout(function() {
                        window.location.href = 'check-profile.html';
                    }, 1500);
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка входа';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Войти';
            }
        };
    }
    
    var phoneResendBtn = document.getElementById('phoneResendBtn');
    if (phoneResendBtn) {
        phoneResendBtn.onclick = async function() {
            var errorDiv = document.getElementById('phoneCodeError');
            try {
                errorDiv.innerText = '';
                var res = await fetch('/api/request-sms-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone })
                });
                
                var data = await res.json();
                
                if (data.success) {
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Новый код отправлен!';
                        setTimeout(function() {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения';
            }
        };
    }
    
    var emailResendBtn = document.getElementById('emailResendBtn');
    if (emailResendBtn) {
        emailResendBtn.onclick = async function() {
            var errorDiv = document.getElementById('emailCodeError');
            try {
                errorDiv.innerText = '';
                var res = await fetch('/api/request-email-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentEmail })
                });
                
                var data = await res.json();
                
                if (data.success) {
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Новый код отправлен!';
                        setTimeout(function() {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения';
            }
        };
    }
}

if (document.getElementById('loading')) {
}

if (document.getElementById('profileForm')) {
}

if (document.getElementById('contactsList')) {
}

setTimeout(function() {
    const selectPhoneBtn = document.getElementById('selectPhoneBtn');
    const selectEmailBtn = document.getElementById('selectEmailBtn');
    const backToMethodBtn = document.getElementById('backToMethodBtn');
    const backToMethodBtn2 = document.getElementById('backToMethodBtn2');
    
    if (selectPhoneBtn) {
        selectPhoneBtn.onclick = function() {
            document.getElementById('methodStep').style.display = 'none';
            document.getElementById('phoneStep').style.display = 'block';
            document.getElementById('emailStep').style.display = 'none';
            document.getElementById('phoneCodeStep').style.display = 'none';
            document.getElementById('emailCodeStep').style.display = 'none';
        };
    }
    
    if (selectEmailBtn) {
        selectEmailBtn.onclick = function() {
            document.getElementById('methodStep').style.display = 'none';
            document.getElementById('phoneStep').style.display = 'none';
            document.getElementById('emailStep').style.display = 'block';
            document.getElementById('phoneCodeStep').style.display = 'none';
            document.getElementById('emailCodeStep').style.display = 'none';
        };
    }
    
    if (backToMethodBtn || backToMethodBtn2) {
        const backHandler = function() {
            document.getElementById('methodStep').style.display = 'block';
            document.getElementById('phoneStep').style.display = 'none';
            document.getElementById('emailStep').style.display = 'none';
            document.getElementById('phoneCodeStep').style.display = 'none';
            document.getElementById('emailCodeStep').style.display = 'none';
        };
        if (backToMethodBtn) backToMethodBtn.onclick = backHandler;
        if (backToMethodBtn2) backToMethodBtn2.onclick = backHandler;
    }  
}, 100);