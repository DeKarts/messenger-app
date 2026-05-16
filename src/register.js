document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') {
        document.body.classList.add('dark-theme');
    }
    let currentPhone = '';
    let currentEmail = '';
    function showMethodStep() {
        const methodStep = document.getElementById('methodStep');
        const phoneStep = document.getElementById('phoneStep');
        const emailStep = document.getElementById('emailStep');
        const phoneCodeStep = document.getElementById('phoneCodeStep');
        const emailCodeStep = document.getElementById('emailCodeStep');
        
        if (methodStep) methodStep.style.display = 'block';
        if (phoneStep) phoneStep.style.display = 'none';
        if (emailStep) emailStep.style.display = 'none';
        if (phoneCodeStep) phoneCodeStep.style.display = 'none';
        if (emailCodeStep) emailCodeStep.style.display = 'none';
    }
    function selectPhoneMethod() {
        const methodStep = document.getElementById('methodStep');
        const phoneStep = document.getElementById('phoneStep');
        const emailStep = document.getElementById('emailStep');
        const phoneCodeStep = document.getElementById('phoneCodeStep');
        const emailCodeStep = document.getElementById('emailCodeStep');
        
        if (methodStep) methodStep.style.display = 'none';
        if (phoneStep) phoneStep.style.display = 'block';
        if (emailStep) emailStep.style.display = 'none';
        if (phoneCodeStep) phoneCodeStep.style.display = 'none';
        if (emailCodeStep) emailCodeStep.style.display = 'none';
    }
    function selectEmailMethod() {
        const methodStep = document.getElementById('methodStep');
        const phoneStep = document.getElementById('phoneStep');
        const emailStep = document.getElementById('emailStep');
        const phoneCodeStep = document.getElementById('phoneCodeStep');
        const emailCodeStep = document.getElementById('emailCodeStep');
        
        if (methodStep) methodStep.style.display = 'none';
        if (phoneStep) phoneStep.style.display = 'none';
        if (emailStep) emailStep.style.display = 'block';
        if (phoneCodeStep) phoneCodeStep.style.display = 'none';
        if (emailCodeStep) emailCodeStep.style.display = 'none';
    }
    const selectPhoneBtn = document.getElementById('selectPhoneBtn');
    const selectEmailBtn = document.getElementById('selectEmailBtn');
    const backToMethodBtn = document.getElementById('backToMethodBtn');
    const backToMethodBtn2 = document.getElementById('backToMethodBtn2');
    if (selectPhoneBtn) selectPhoneBtn.onclick = selectPhoneMethod;
    if (selectEmailBtn) selectEmailBtn.onclick = selectEmailMethod;
    if (backToMethodBtn) backToMethodBtn.onclick = showMethodStep;
    if (backToMethodBtn2) backToMethodBtn2.onclick = showMethodStep; 
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
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
                let formatted = '+' + value[0];
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
    
    // Отправка телефона
    const phoneForm = document.getElementById('phoneForm');
    if (phoneForm) {
        phoneForm.onsubmit = async function(e) {
            e.preventDefault();
            const phone = document.getElementById('phone').value;
            const errorDiv = document.getElementById('phoneError');
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Отправка...';
                if (errorDiv) errorDiv.innerText = '';
                
                const res = await fetch('/api/request-sms-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: phone })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    currentPhone = phone;
                    const phoneDisplay = document.getElementById('phoneDisplay');
                    if (phoneDisplay) phoneDisplay.innerText = phone;
                    
                    const phoneStep = document.getElementById('phoneStep');
                    const phoneCodeStep = document.getElementById('phoneCodeStep');
                    if (phoneStep) phoneStep.style.display = 'none';
                    if (phoneCodeStep) phoneCodeStep.style.display = 'block';
                    
                    const phoneCode = document.getElementById('phoneCode');
                    if (phoneCode) phoneCode.focus();
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Код отправлен!';
                        setTimeout(() => {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки кода';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения: ' + err.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Получить код';
            }
        };
    }
    
    // Отправка email
    const emailForm = document.getElementById('emailForm');
    if (emailForm) {
        emailForm.onsubmit = async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const errorDiv = document.getElementById('emailError');
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Отправка...';
                if (errorDiv) errorDiv.innerText = '';
                
                const res = await fetch('/api/request-email-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    currentEmail = email;
                    const emailDisplay = document.getElementById('emailDisplay');
                    if (emailDisplay) emailDisplay.innerText = email;
                    
                    const emailStep = document.getElementById('emailStep');
                    const emailCodeStep = document.getElementById('emailCodeStep');
                    if (emailStep) emailStep.style.display = 'none';
                    if (emailCodeStep) emailCodeStep.style.display = 'block';
                    
                    const emailCode = document.getElementById('emailCode');
                    if (emailCode) emailCode.focus();
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Код отправлен!';
                        setTimeout(() => {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки кода';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения: ' + err.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Получить код';
            }
        };
    }
    
    // Регистрация по SMS-коду
    const phoneCodeForm = document.getElementById('phoneCodeForm');
    if (phoneCodeForm) {
        phoneCodeForm.onsubmit = async function(e) {
            e.preventDefault();
            const code = document.getElementById('phoneCode').value;
            const errorDiv = document.getElementById('phoneCodeError');
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Регистрация...';
                const res = await fetch('/api/login-by-sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone, code: code })
                });
                
                const data = await res.json();

                if (data.success && data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('myPhone', data.user.phone);
                    localStorage.setItem('myUserId', data.user.id);
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Регистрация успешна! Перенаправление...';
                    }
                    
                    setTimeout(() => {
                        window.location.href = 'check-profile.html';
                    }, 1500);
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка регистрации';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения: ' + err.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Зарегистрироваться';
            }
        };
    }
    
    // Регистрация по email-коду
    const emailCodeForm = document.getElementById('emailCodeForm');
    if (emailCodeForm) {
        emailCodeForm.onsubmit = async function(e) {
            e.preventDefault();
            const code = document.getElementById('emailCode').value;
            const errorDiv = document.getElementById('emailCodeError');
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Регистрация...';
                const res = await fetch('/api/login-by-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentEmail, code: code })
                });
                
                const data = await res.json();

                if (data.success && data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('myEmail', data.user.email);
                    localStorage.setItem('myUserId', data.user.id);
                    
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Регистрация успешна! Перенаправление...';
                    }
                    
                    setTimeout(() => {
                        window.location.href = 'check-profile.html';
                    }, 1500);
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка регистрации';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения: ' + err.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Зарегистрироваться';
            }
        };
    }
    
    // Повторная отправка SMS-кода
    const phoneResendBtn = document.getElementById('phoneResendBtn');
    if (phoneResendBtn) {
        phoneResendBtn.onclick = async function() {
            const errorDiv = document.getElementById('phoneCodeError');
            try {
                errorDiv.innerText = '';
                const res = await fetch('/api/request-sms-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Новый код отправлен!';
                        setTimeout(() => {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки кода';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения: ' + err.message;
            }
        };
    }
    
    // Повторная отправка кода email-кода
    const emailResendBtn = document.getElementById('emailResendBtn');
    if (emailResendBtn) {
        emailResendBtn.onclick = async function() {
            const errorDiv = document.getElementById('emailCodeError');
            try {
                errorDiv.innerText = '';
                const res = await fetch('/api/request-email-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentEmail })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    if (errorDiv) {
                        errorDiv.className = 'text-success mt-2 text-center';
                        errorDiv.innerText = 'Новый код отправлен!';
                        setTimeout(() => {
                            errorDiv.className = 'text-danger mt-2 text-center';
                            errorDiv.innerText = '';
                        }, 3000);
                    }
                } else {
                    if (errorDiv) errorDiv.innerText = data.error || 'Ошибка отправки кода';
                }
            } catch (err) {
                if (errorDiv) errorDiv.innerText = 'Ошибка соединения: ' + err.message;
            }
        };
    }
});