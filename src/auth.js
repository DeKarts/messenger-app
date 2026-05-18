const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { getConnection, sql } = require('./db');
const https = require('https');
const isDev = process.env.NODE_ENV !== 'production';

// SMS-шлюз
async function sendSmsViaGateway(phone, message) {
    if (!process.env.SMS_API_KEY) {
        throw new Error('SMS_API_KEY не настроен');
    }
    
    const apiKey = process.env.SMS_API_KEY;
    const from = process.env.SMS_FROM;
    const to = phone.replace(/\D/g, '');
    const url = `https://sms.ru/sms/send?api_id=${apiKey}&to=${to}&msg=${encodeURIComponent(message)}${from ? '&from=' + encodeURIComponent(from) : ''}&json=1`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    const smsResult = result.sms && result.sms[to];
                    if (smsResult && smsResult.status === 'OK') {
                        resolve({ success: true });
                    } else if (smsResult && smsResult.status === 'ERROR') {
                        reject(new Error(`SMS.ru ошибка ${smsResult.status_code}: ${smsResult.status_text || 'Неизвестная ошибка'}`));
                    } else if (result.status !== 'OK') {
                        reject(new Error(`SMS.ru ошибка ${result.status_code}: ${result.status_text || 'Неизвестная ошибка'}`));
                    } else {
                        reject(new Error('SMS.ru: неожиданный ответ от сервера'));
                    }
                } catch (err) {
                    reject(new Error(`Не удалось разобрать ответ SMS.ru: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

// Email-шлюз

let emailTransporter;

if (process.env.EMAIL_SERVICE === 'custom' || process.env.EMAIL_HOST) {
    emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_PORT === '465',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: { rejectUnauthorized: !isDev },
        logger: isDev,
        debug: isDev
    });
} else {
    emailTransporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        logger: isDev,
        debug: isDev
    });
}

// Генерация кода

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Адаптация номера

function normalizePhone(phone) {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (!digits.startsWith('7')) digits = '7' + digits;
    return digits.length === 11 ? digits : null;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Првоерка на свободность номера

async function isPhoneTaken(phone, excludeUserId = null) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return false;
    
    try {
        const pool = await getConnection();
        let query = 'SELECT id FROM Users WHERE phone = @phone';
        if (excludeUserId) query += ' AND id != @userId';
        
        const result = await pool.request()
            .input('phone', sql.NVarChar, normalizedPhone)
            .input('userId', excludeUserId ? sql.Int : sql.Int, excludeUserId)
            .query(query);
        
        return result.recordset && result.recordset.length > 0;
    } catch {
        return false;
    }
}

// Првоерка на свободность почты
async function isEmailTaken(email, excludeUserId = null) {
    if (!isValidEmail(email)) return false;
    
    try {
        const pool = await getConnection();
        let query = 'SELECT id FROM Users WHERE email = @email';
        if (excludeUserId) query += ' AND id != @userId';
        
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('userId', excludeUserId ? sql.Int : sql.Int, excludeUserId)
            .query(query);
        
        return result.recordset && result.recordset.length > 0;
    } catch {
        return false;
    }
}

// Отправка кода

async function sendSmsCode(phone) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    if (!process.env.SMS_API_KEY) {
        return { code, expiresAt };
    }
    
    const message = `Ваш код для входа в мессенджер: ${code}`;
    
    try {
        await sendSmsViaGateway(phone, message);
    } catch (err) {
        if (process.env.NODE_ENV === 'development') {
            return { code, expiresAt };
        }
        throw new Error('Не удалось отправить SMS: ' + err.message);
    }
    
    return { code, expiresAt };
}

async function sendEmailCode(email) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return { code, expiresAt };
    }
    
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Код подтверждения для мессенджера',
            html: `
                <h2>Код подтверждения</h2>
                <p>Ваш код для входа в мессенджер:</p>
                <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">${code}</h1>
                <p>Код действителен 5 минут.</p>
                <p>Если вы не запрашивали этот код, просто проигнорируйте письмо.</p>
            `
        });
    } catch (err) {
        throw new Error('Не удалось отправить письмо: ' + err.message);
    }
    
    return { code, expiresAt };
}

// Запрос кода

async function requestSmsCode(phone, userId = null) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
        return { success: false, error: 'Неверный формат номера' };
    }
    
    if (userId) {
        const taken = await isPhoneTaken(phone, userId);
        if (taken) return { success: false, error: 'Этот номер уже используется' };
    }
    
    try {
        const { code, expiresAt } = await sendSmsCode(normalizedPhone);
        const pool = await getConnection();
        
        await pool.request()
            .input('phone', sql.NVarChar, normalizedPhone)
            .input('code', sql.NVarChar, code)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query(`
                MERGE INTO Users AS target
                USING (SELECT @phone AS phone) AS source
                ON target.phone = source.phone
                WHEN MATCHED THEN
                    UPDATE SET sms_code = @code, sms_code_expires = @expiresAt
                WHEN NOT MATCHED THEN
                    INSERT (phone, sms_code, sms_code_expires, created_at)
                    VALUES (@phone, @code, @expiresAt, GETDATE());
            `);
        
        return { success: true, message: 'Код отправлен' };
    } catch (err) {
        return { success: false, error: 'Ошибка отправки кода: ' + err.message };
    }
}

async function requestEmailCode(email, userId = null) {
    if (!isValidEmail(email)) {
        return { success: false, error: 'Неверный формат email' };
    }
    
    if (userId) {
        const taken = await isEmailTaken(email, userId);
        if (taken) return { success: false, error: 'Этот email уже используется' };
    }
    
    try {
        const { code, expiresAt } = await sendEmailCode(email);
        const pool = await getConnection();
        
        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('code', sql.NVarChar, code)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query(`
                MERGE INTO Users AS target
                USING (SELECT @email AS email) AS source
                ON target.email = source.email
                WHEN MATCHED THEN
                    UPDATE SET email_code = @code, email_code_expires = @expiresAt
                WHEN NOT MATCHED THEN
                    INSERT (email, email_code, email_code_expires, created_at)
                    VALUES (@email, @code, @expiresAt, GETDATE());
            `);
        
        return { success: true, message: 'Код отправлен на email' };
    } catch (err) {
        return { success: false, error: 'Ошибка отправки кода: ' + err.message };
    }
}

// Вход по коду

async function loginBySms(phone, code) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
        return { success: false, error: 'Неверный формат номера' };
    }
    
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('phone', sql.NVarChar, normalizedPhone)
            .query('SELECT id, phone, sms_code, sms_code_expires FROM Users WHERE phone = @phone');
        
        if (!result.recordset || result.recordset.length === 0) {
            return { success: false, error: 'Пользователь не найден' };
        }
        
        const user = result.recordset[0];
        
        if (!user.sms_code || user.sms_code !== code) {
            return { success: false, error: 'Неверный код' };
        }
        
        if (user.sms_code_expires && new Date(user.sms_code_expires) < new Date()) {
            return { success: false, error: 'Код истёк' };
        }
        
        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        
        const token = jwt.sign(
            { id: userId, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        await pool.request()
            .input('phone', sql.NVarChar, normalizedPhone)
            .query('UPDATE Users SET sms_code = NULL, sms_code_expires = NULL, last_seen = GETDATE() WHERE phone = @phone');
        
        return { success: true, token, user: { id: userId, phone: user.phone } };
    } catch (err) {
        return { success: false, error: 'Ошибка входа: ' + err.message };
    }
}

async function loginByEmail(email, code) {
    if (!isValidEmail(email)) {
        return { success: false, error: 'Неверный формат email' };
    }
    
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT id, email, email_code, email_code_expires FROM Users WHERE email = @email');
        
        if (!result.recordset || result.recordset.length === 0) {
            return { success: false, error: 'Пользователь не найден' };
        }
        
        const user = result.recordset[0];
        
        if (!user.email_code || user.email_code !== code) {
            return { success: false, error: 'Неверный код' };
        }
        
        if (user.email_code_expires && new Date(user.email_code_expires) < new Date()) {
            return { success: false, error: 'Код истёк' };
        }
        
        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        
        const token = jwt.sign(
            { id: userId, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        await pool.request()
            .input('email', sql.NVarChar, email)
            .query('UPDATE Users SET email_code = NULL, email_code_expires = NULL, last_seen = GETDATE() WHERE email = @email');
        
        return { success: true, token, user: { id: userId, email: user.email } };
    } catch (err) {
        return { success: false, error: 'Ошибка входа: ' + err.message };
    }
}

// Проверка кода

async function verifySmsCode(phone, code) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return false;
    
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('phone', sql.NVarChar, normalizedPhone)
            .query('SELECT sms_code, sms_code_expires FROM Users WHERE phone = @phone');
        
        if (!result.recordset || result.recordset.length === 0) return false;
        
        const user = result.recordset[0];
        if (!user.sms_code || user.sms_code !== code) return false;
        if (user.sms_code_expires && new Date(user.sms_code_expires) < new Date()) return false;
        
        return true;
    } catch {
        return false;
    }
}

async function verifyEmailCode(email, code) {
    if (!isValidEmail(email)) return false;
    
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT email_code, email_code_expires FROM Users WHERE email = @email');
        
        if (!result.recordset || result.recordset.length === 0) return false;
        
        const user = result.recordset[0];
        if (!user.email_code || user.email_code !== code) return false;
        if (user.email_code_expires && new Date(user.email_code_expires) < new Date()) return false;
        
        return true;
    } catch {
        return false;
    }
}

// Смена email или номера

async function requestOldPhoneCode(userId) {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT phone FROM Users WHERE id = @userId');
        
        if (!result.recordset || result.recordset.length === 0) {
            return { success: false, error: 'Пользователь не найден' };
        }
        
        const phone = result.recordset[0].phone;
        if (!phone) return { success: false, error: 'Телефон не привязан' };
        
        const { code, expiresAt } = await sendSmsCode(phone);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('code', sql.NVarChar, code)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query('UPDATE Users SET sms_code = @code, sms_code_expires = @expiresAt WHERE id = @userId');
        
        return { success: true, message: 'Код отправлен', phone };
    } catch (err) {
        return { success: false, error: 'Ошибка отправки кода: ' + err.message };
    }
}

async function verifyOldPhoneCode(userId, code) {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT sms_code, sms_code_expires FROM Users WHERE id = @userId');
        
        if (!result.recordset || result.recordset.length === 0) {
            return { success: false, error: 'Пользователь не найден' };
        }
        
        const user = result.recordset[0];
        if (!user.sms_code || user.sms_code !== code) {
            return { success: false, error: 'Неверный код' };
        }
        if (user.sms_code_expires && new Date(user.sms_code_expires) < new Date()) {
            return { success: false, error: 'Код истёк' };
        }
        
        return { success: true };
    } catch (err) {
        return { success: false, error: 'Ошибка проверки кода: ' + err.message };
    }
}

async function requestOldEmailCode(userId) {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT email FROM Users WHERE id = @userId');
        
        if (!result.recordset || result.recordset.length === 0) {
            return { success: false, error: 'Пользователь не найден' };
        }
        
        const email = result.recordset[0].email;
        if (!email) return { success: false, error: 'Email не привязан' };
        
        const { code, expiresAt } = await sendEmailCode(email);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('code', sql.NVarChar, code)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query('UPDATE Users SET email_code = @code, email_code_expires = @expiresAt WHERE id = @userId');
        
        return { success: true, message: 'Код отправлен', email };
    } catch (err) {
        return { success: false, error: 'Ошибка отправки кода: ' + err.message };
    }
}

async function verifyOldEmailCode(userId, code) {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT email_code, email_code_expires FROM Users WHERE id = @userId');
        
        if (!result.recordset || result.recordset.length === 0) {
            return { success: false, error: 'Пользователь не найден' };
        }
        
        const user = result.recordset[0];
        if (!user.email_code || user.email_code !== code) {
            return { success: false, error: 'Неверный код' };
        }
        if (user.email_code_expires && new Date(user.email_code_expires) < new Date()) {
            return { success: false, error: 'Код истёк' };
        }
        
        return { success: true };
    } catch (err) {
        return { success: false, error: 'Ошибка проверки кода: ' + err.message };
    }
}

module.exports = { 
    requestSmsCode, 
    requestEmailCode, 
    loginBySms, 
    loginByEmail, 
    verifySmsCode, 
    verifyEmailCode,
    requestOldPhoneCode,
    verifyOldPhoneCode,
    requestOldEmailCode,
    verifyOldEmailCode,
    isPhoneTaken,
    isEmailTaken,
    normalizePhone, 
    isValidEmail 
};