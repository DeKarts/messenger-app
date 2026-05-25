require('dotenv').config();

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const { requestSmsCode, requestEmailCode, loginBySms, loginByEmail, normalizePhone, verifySmsCode, verifyEmailCode, requestOldPhoneCode, verifyOldPhoneCode, requestOldEmailCode, verifyOldEmailCode } = require('./auth');
const { sendMessage, getMessages, deleteMessage, editMessage, sendFileMessage, forwardMessage, replyMessage, getUnreadCounts, markMessagesAsRead } = require('./messages');
const { getConnection, sql } = require('./db');

// Инициализация

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => res.redirect('/login.html'));

// Папки для загрузок

const uploadsDir = path.join(__dirname, '../public/uploads');
const avatarsDir = path.join(__dirname, '../public/uploads/avatars');
const messagesDir = path.join(__dirname, '../public/uploads/messages');

[uploadsDir, avatarsDir, messagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Настройки multer

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) => {
        const userId = typeof req.user.id === 'string' ? req.user.id : req.user.id;
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${userId}${ext}`);
    }
});

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        cb(null, extname && mimetype);
    }
});

const uploadFiles = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, messagesDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Аутентификация

function auth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token: ' + err.message });
    }
}


app.post('/api/request-sms-code', async (req, res) => {
    try {
        const { phone } = req.body;
        let userId = null;
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = typeof decoded.id === 'string' ? parseInt(decoded.id) : decoded.id;
            } catch {}
        }
        
        const result = await requestSmsCode(phone, userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/request-email-code', async (req, res) => {
    try {
        const { email } = req.body;
        let userId = null;
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = typeof decoded.id === 'string' ? parseInt(decoded.id) : decoded.id;
            } catch {}
        }
        
        const result = await requestEmailCode(email, userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login-by-sms', async (req, res) => {
    try {
        const { phone, code } = req.body;
        const result = await loginBySms(phone, code);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login-by-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        const result = await loginByEmail(email, code);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Подтверждения email или номера

app.post('/api/verify-phone', auth, async (req, res) => {
    try {
        const { phone, code } = req.body;
        const isValid = await verifySmsCode(phone, code);
        if (!isValid) return res.status(400).json({ error: 'Неверный код или код истёк' });
        
        const pool = await getConnection();
        await pool.request()
            .input('phone', sql.NVarChar, normalizePhone(phone))
            .input('userId', sql.Int, req.user.id)
            .query('UPDATE Users SET phone = @phone WHERE id = @userId');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/verify-email', auth, async (req, res) => {
    try {
        const { email, code } = req.body;
        const isValid = await verifyEmailCode(email, code);
        if (!isValid) return res.status(400).json({ error: 'Неверный код или код истёк' });
        
        const pool = await getConnection();
        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('userId', sql.Int, req.user.id)
            .query('UPDATE Users SET email = @email WHERE id = @userId');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Замена email или номера

app.post('/api/request-phone-change-code', auth, async (req, res) => {
    try {
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const result = await requestOldPhoneCode(userId);
        result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/verify-old-phone', auth, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const result = await verifyOldPhoneCode(userId, code);
        result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/request-email-change-code', auth, async (req, res) => {
    try {
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const result = await requestOldEmailCode(userId);
        result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/verify-old-email', auth, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const result = await verifyOldEmailCode(userId, code);
        result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Сообщения

app.post('/api/message', auth, async (req, res) => {
    try {
        let result;
        if (req.body.replyToMessageId) {
            result = await replyMessage(req.user.id, req.body.to, req.body.text, parseInt(req.body.replyToMessageId));
        } else if (req.body.forwardedMessageId) {
            result = await forwardMessage(req.user.id, req.body.to, parseInt(req.body.forwardedMessageId), req.body.forwardSenderName, req.body.forwardOriginalText, req.body.forwardSenderLastName);
        } else {
            result = await sendMessage(req.user.id, req.body.to, req.body.text);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/message/upload', auth, uploadFiles.array('files[]', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Файлы не загружены' });
        }
        
        const pool = await getConnection();
        const toUser = await pool.request()
            .input('identifier', sql.NVarChar, req.body.to)
            .query(`SELECT id FROM Users WHERE email = @identifier OR phone = @identifier OR username = @identifier OR display_name = @identifier`);
        
        if (!toUser.recordset?.[0]?.id) {
            return res.status(404).json({ error: 'Получатель не найден' });
        }
        
        const filepaths = req.files.map(file => `/uploads/messages/${file.filename}`);
        const result = await sendFileMessage(
            req.user.id, toUser.recordset[0].id, req.body.text || '', filepaths,
            req.body.forwardedMessageId ? parseInt(req.body.forwardedMessageId) : null,
            req.body.forwardSenderName || null, req.body.forwardSenderLastName || null, req.body.forwardOriginalText || null
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/messages/:param', auth, async (req, res) => {
    try {
        const param = req.params.param;
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const isNumeric = /^\d+$/.test(param);
        
        if (isNumeric) {
            const pool = await getConnection();
            const result = await pool.request()
                .input('id', sql.Int, parseInt(param))
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT m.id, COALESCE(u_from.display_name, u_from.username, u_from.phone, u_from.email) AS fromUser,
                           u_from.last_name AS fromLastName, COALESCE(u_to.display_name, u_to.username, u_to.phone, u_to.email) AS toUser,
                           m.from_user_id AS fromUserId, m.to_user_id AS toUserId, m.text AS messageText, m.file_path AS filePath,
                           m.reply_to_id AS replyToId, m.forwarded_message_id AS forwardedMessageId, m.forwarded_sender_name AS forwardedSenderName,
                           FORMAT(m.created_at, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS sentAt, m.deleted_at AS deletedAt
                    FROM Messages m
                    JOIN Users u_from ON m.from_user_id = u_from.id
                    JOIN Users u_to ON m.to_user_id = u_to.id
                    WHERE m.id = @id AND (m.from_user_id = @userId OR m.to_user_id = @userId)
                `);
            
            if (!result.recordset?.[0]) return res.status(404).json({ error: 'Сообщение не найдено' });
            
            const message = result.recordset[0];
            const fullFromUser = message.fromLastName?.trim() ? `${message.fromUser} ${message.fromLastName}` : message.fromUser;
            res.json({ ...message, fromUser: fullFromUser, isDeleted: !!message.deletedAt });
        } else {
            const messages = await getMessages(userId, param);
            res.json(messages);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/messages/:id', auth, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const result = await deleteMessage(messageId, userId);
        if (result.error) return res.status(403).json({ error: result.error });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/messages/:id', auth, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const { text } = req.body;
        
        if (!text?.trim()) return res.status(400).json({ error: 'Введите текст сообщения' });
        
        const result = await editMessage(messageId, userId, text.trim());
        if (result.error) return res.status(403).json({ error: result.error });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/messages/unread-count', auth, async (req, res) => {
    try {
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const counts = await getUnreadCounts(userId);
        res.json(counts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messages/mark-read/:contactId', auth, async (req, res) => {
    try {
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const contactId = parseInt(req.params.contactId);
        const result = await markMessagesAsRead(userId, contactId);
        if (result.error) return res.status(500).json({ error: result.error });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Профиль

app.get('/api/profile/me', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        await pool.request().input('id', sql.Int, userId).query('UPDATE Users SET last_seen = GETDATE() WHERE id = @id');
        
        const result = await pool.request()
            .input('id', sql.Int, userId)
            .query(`SELECT id, display_name AS displayName, last_name AS lastName, avatar_url AS avatarUrl, bio, phone, email, 
                           FORMAT(created_at, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS createdAt, 
                           FORMAT(last_seen, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS lastSeen FROM Users WHERE id = @id`);
        
        if (!result.recordset?.[0]) return res.status(404).json({ error: 'Пользователь не найден' });
        
        let hidePhone = false, hideEmail = false;
        try {
            const privacyResult = await pool.request().input('id', sql.Int, userId).query('SELECT hide_phone, hide_email FROM Users WHERE id = @id');
            if (privacyResult.recordset?.[0]) {
                const hp = privacyResult.recordset[0].hide_phone;
                const he = privacyResult.recordset[0].hide_email;
                hidePhone = hp === true || hp === 1 || hp === '1';
                hideEmail = he === true || he === 1 || he === '1';
            }
        } catch {}
        
        res.json({ ...result.recordset[0], hidePhone, hideEmail });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/profile/me', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const { displayName, lastName, bio, hidePhone, hideEmail } = req.body;
        
        await pool.request()
            .input('id', sql.Int, userId)
            .input('displayName', sql.NVarChar, displayName)
            .input('lastName', sql.NVarChar, lastName || null)
            .input('bio', sql.NVarChar, bio)
            .input('hidePhone', sql.Bit, hidePhone === true ? 1 : 0)
            .input('hideEmail', sql.Bit, hideEmail === true ? 1 : 0)
            .query(`UPDATE Users SET display_name = @displayName, last_name = @lastName, bio = @bio, 
                    hide_phone = @hidePhone, hide_email = @hideEmail, last_seen = GETDATE() WHERE id = @id`);
        
        res.json({ success: true, message: 'Профиль обновлён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profile/avatar', auth, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
        
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const ext = path.extname(req.file.originalname);
        const avatarUrl = `/uploads/avatars/avatar_${userId}${ext}`;
        const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        for (const oldExt of extensions) {
            if (oldExt !== ext) {
                const oldPath = path.join(avatarsDir, `avatar_${userId}${oldExt}`);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }
        
        await pool.request().input('id', sql.Int, userId).input('avatarUrl', sql.NVarChar, avatarUrl).query('UPDATE Users SET avatar_url = @avatarUrl WHERE id = @id');
        res.json({ success: true, avatarUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/profile/:userId', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const otherUserId = parseInt(req.params.userId);
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        await pool.request().input('id', sql.Int, userId).query('UPDATE Users SET last_seen = GETDATE() WHERE id = @id');
        
        const result = await pool.request()
            .input('id', sql.Int, otherUserId)
            .query(`SELECT id, COALESCE(display_name, username, phone, email) AS displayName, last_name AS lastName, 
                           avatar_url AS avatarUrl, bio, phone, email, FORMAT(last_seen, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS lastSeen 
                    FROM Users WHERE id = @id`);
        
        if (!result.recordset?.[0]) return res.status(404).json({ error: 'Пользователь не найден' });
        
        let hidePhone = false, hideEmail = false;
        try {
            const privacyResult = await pool.request().input('id', sql.Int, otherUserId).query('SELECT hide_phone, hide_email FROM Users WHERE id = @id');
            if (privacyResult.recordset?.[0]) {
                const hp = privacyResult.recordset[0].hide_phone;
                const he = privacyResult.recordset[0].hide_email;
                hidePhone = hp === true || hp === 1 || hp === '1';
                hideEmail = he === true || he === 1 || he === '1';
            }
        } catch {}
        
        const user = result.recordset[0];
        let lastSeenFormatted = 'Неизвестно';
        if (user.lastSeen) {
            const lastSeenDate = new Date(user.lastSeen);
            const diffMs = Date.now() - lastSeenDate;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) lastSeenFormatted = 'В сети';
            else if (diffMins < 60) lastSeenFormatted = `${diffMins} мин. назад`;
            else if (diffHours < 24) lastSeenFormatted = `${diffHours} ч. назад`;
            else if (diffDays < 7) lastSeenFormatted = `${diffDays} дн. назад`;
            else lastSeenFormatted = lastSeenDate.toLocaleDateString('ru-RU');
        }
        
        res.json({ ...user, lastSeen: lastSeenFormatted, lastSeenRaw: user.lastSeen, hidePhone, hideEmail });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Контакты

app.get('/api/users/search', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const searchTerm = req.query.q || '';
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        const result = await pool.request()
            .input('search', sql.NVarChar, '%' + searchTerm + '%')
            .input('userId', sql.Int, userId)
            .query(`SELECT id, COALESCE(display_name, username, phone, email) AS displayName, phone, email 
                    FROM Users WHERE (display_name LIKE @search OR username LIKE @search OR phone LIKE @search OR email LIKE @search) AND id != @userId`);
        
        const users = await Promise.all(result.recordset.map(async (row) => {
            let hidePhone = false, hideEmail = false;
            try {
                const privacyResult = await pool.request().input('id', sql.Int, row.id).query('SELECT hide_phone, hide_email FROM Users WHERE id = @id');
                if (privacyResult.recordset?.[0]) {
                    const hp = privacyResult.recordset[0].hide_phone;
                    const he = privacyResult.recordset[0].hide_email;
                    hidePhone = hp === true || hp === 1 || hp === '1';
                    hideEmail = he === true || he === 1 || he === '1';
                }
            } catch {}
            return { id: row.id, username: row.displayName, phone: hidePhone ? null : row.phone, email: hideEmail ? null : row.email };
        }));
        
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Введите email, телефон или имя' });
        
        const userCheck = await pool.request()
            .input('identifier', sql.NVarChar, username)
            .query(`SELECT id FROM Users WHERE email = @identifier OR phone = @identifier OR username = @identifier OR display_name = @identifier`);
        
        if (!userCheck.recordset?.[0]) return res.status(404).json({ error: 'Пользователь не найден' });
        
        const contactId = userCheck.recordset[0].id;
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        if (contactId === userId) return res.status(400).json({ error: 'Нельзя добавить себя' });
        
        const alreadyFriends = await pool.request()
            .input('user1', sql.Int, userId)
            .input('user2', sql.Int, contactId)
            .query('SELECT id FROM Contacts WHERE (user_id = @user1 AND contact_id = @user2) OR (user_id = @user2 AND contact_id = @user1)');
        
        if (alreadyFriends.recordset?.length > 0) return res.status(400).json({ error: 'Вы уже друзья' });
        
        const existingRequest = await pool.request()
            .input('sender', sql.Int, userId)
            .input('receiver', sql.Int, contactId)
            .query('SELECT id, status FROM FriendRequests WHERE sender_id = @sender AND receiver_id = @receiver');
        
        if (existingRequest.recordset?.length > 0) {
            const status = existingRequest.recordset[0].status;
            if (status === 'pending') return res.status(400).json({ error: 'Запрос уже отправлен и ожидает подтверждения' });
            if (status === 'accepted') return res.status(400).json({ error: 'Вы уже друзья' });
        }
        
        await pool.request()
            .input('sender', sql.Int, userId)
            .input('receiver', sql.Int, contactId)
            .query('INSERT INTO FriendRequests (sender_id, receiver_id, status) VALUES (@sender, @receiver, \'pending\')');
        
        res.json({ success: true, message: 'Запрос в друзья отправлен. Ожидайте подтверждения.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/contacts', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        const result = await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`SELECT u.id, COALESCE(u.display_name, u.username, u.phone, u.email) AS displayName, u.last_name AS lastName,
                           u.phone, u.email, u.avatar_url AS avatarUrl, c.created_at AS addedAt
                    FROM Contacts c JOIN Users u ON c.contact_id = u.id WHERE c.user_id = @user_id ORDER BY c.created_at DESC`);
        
        const contacts = await Promise.all((result.recordset || []).map(async (row) => {
            let hidePhone = false, hideEmail = false;
            try {
                const privacyResult = await pool.request().input('id', sql.Int, row.id).query('SELECT hide_phone, hide_email FROM Users WHERE id = @id');
                if (privacyResult.recordset?.[0]) {
                    const hp = privacyResult.recordset[0].hide_phone;
                    const he = privacyResult.recordset[0].hide_email;
                    hidePhone = hp === true || hp === 1 || hp === '1';
                    hideEmail = he === true || he === 1 || he === '1';
                }
            } catch {}
            return { id: row.id, username: row.displayName, lastName: row.lastName, phone: hidePhone ? null : row.phone, email: hideEmail ? null : row.email, avatarUrl: row.avatarUrl, addedAt: row.addedAt };
        }));
        
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contacts/:id', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const contactId = parseInt(req.params.id);
        
        const transaction = pool.transaction();
        
        try {
            await transaction.begin();
            
            // Удаляем запись из Contacts
            await transaction.request()
                .input('user_id', sql.Int, userId)
                .input('contact_id', sql.Int, contactId)
                .query('DELETE FROM Contacts WHERE user_id = @user_id AND contact_id = @contact_id');
            
            // Удаляем или обновляем запись в FriendRequests
            await transaction.request()
                .input('sender', sql.Int, userId)
                .input('receiver', sql.Int, contactId)
                .query("UPDATE FriendRequests SET status = 'declined' WHERE sender_id = @sender AND receiver_id = @receiver AND status = 'accepted'");
            
            await transaction.request()
                .input('sender', sql.Int, contactId)
                .input('receiver', sql.Int, userId)
                .query("UPDATE FriendRequests SET status = 'declined' WHERE sender_id = @sender AND receiver_id = @receiver AND status = 'accepted'");
            
            await transaction.commit();
            res.json({ success: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Запросы в друзья

app.post('/api/friend-requests', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const senderId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const { receiverId } = req.body;
        
        if (!receiverId) return res.status(400).json({ error: 'Не указан пользователь' });
        if (senderId === receiverId) return res.status(400).json({ error: 'Нельзя отправить запрос себе' });
        
        const alreadyFriends = await pool.request()
            .input('user1', sql.Int, senderId)
            .input('user2', sql.Int, receiverId)
            .query('SELECT id FROM Contacts WHERE (user_id = @user1 AND contact_id = @user2) OR (user_id = @user2 AND contact_id = @user1)');
        
        if (alreadyFriends.recordset?.length > 0) return res.status(400).json({ error: 'Вы уже друзья' });
        
        const existingRequest = await pool.request()
            .input('sender', sql.Int, senderId)
            .input('receiver', sql.Int, receiverId)
            .query('SELECT id, status FROM FriendRequests WHERE sender_id = @sender AND receiver_id = @receiver');
        
        if (existingRequest.recordset?.length > 0) {
            const status = existingRequest.recordset[0].status;
            if (status === 'pending') return res.status(400).json({ error: 'Запрос уже отправлен' });
            if (status === 'accepted') return res.status(400).json({ error: 'Вы уже друзья' });
        }
        
        await pool.request()
            .input('sender', sql.Int, senderId)
            .input('receiver', sql.Int, receiverId)
            .query('INSERT INTO FriendRequests (sender_id, receiver_id, status) VALUES (@sender, @receiver, \'pending\')');
        
        res.json({ success: true, message: 'Запрос отправлен' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/friend-requests/incoming', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`SELECT fr.id, fr.sender_id AS senderId, FORMAT(fr.created_at, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS createdAt,
                           COALESCE(u.display_name, u.username, u.phone, u.email) AS senderName, u.avatar_url AS avatarUrl, u.phone, u.email
                    FROM FriendRequests fr JOIN Users u ON fr.sender_id = u.id
                    WHERE fr.receiver_id = @userId AND fr.status = 'pending' ORDER BY fr.created_at DESC`);
        
        const requests = await Promise.all((result.recordset || []).map(async (row) => {
            let hidePhone = false, hideEmail = false;
            try {
                const privacyResult = await pool.request().input('id', sql.Int, row.senderId).query('SELECT hide_phone, hide_email FROM Users WHERE id = @id');
                if (privacyResult.recordset?.[0]) {
                    const hp = privacyResult.recordset[0].hide_phone;
                    const he = privacyResult.recordset[0].hide_email;
                    hidePhone = hp === true || hp === 1 || hp === '1';
                    hideEmail = he === true || he === 1 || he === '1';
                }
            } catch {}
            return { id: row.id, senderId: row.senderId, senderName: row.senderName, avatarUrl: row.avatarUrl, phone: hidePhone ? null : row.phone, email: hideEmail ? null : row.email, createdAt: row.createdAt };
        }));
        
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/friend-requests/outgoing', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`SELECT fr.id, fr.receiver_id AS receiverId, FORMAT(fr.created_at, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS createdAt,
                           COALESCE(u.display_name, u.username, u.phone, u.email) AS receiverName, u.avatar_url AS avatarUrl, u.phone, u.email
                    FROM FriendRequests fr JOIN Users u ON fr.receiver_id = u.id
                    WHERE fr.sender_id = @userId AND fr.status = 'pending' ORDER BY fr.created_at DESC`);
        
        const requests = await Promise.all((result.recordset || []).map(async (row) => {
            let hidePhone = false, hideEmail = false;
            try {
                const privacyResult = await pool.request().input('id', sql.Int, row.receiverId).query('SELECT hide_phone, hide_email FROM Users WHERE id = @id');
                if (privacyResult.recordset?.[0]) {
                    const hp = privacyResult.recordset[0].hide_phone;
                    const he = privacyResult.recordset[0].hide_email;
                    hidePhone = hp === true || hp === 1 || hp === '1';
                    hideEmail = he === true || he === 1 || he === '1';
                }
            } catch {}
            return { id: row.id, receiverId: row.receiverId, receiverName: row.receiverName, avatarUrl: row.avatarUrl, phone: hidePhone ? null : row.phone, email: hideEmail ? null : row.email, createdAt: row.createdAt };
        }));
        
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friend-requests/:id/accept', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const requestId = parseInt(req.params.id);
        
        const request = await pool.request()
            .input('id', sql.Int, requestId)
            .input('userId', sql.Int, userId)
            .query('SELECT sender_id, receiver_id FROM FriendRequests WHERE id = @id AND receiver_id = @userId AND status = \'pending\'');
        
        if (!request.recordset?.[0]) return res.status(404).json({ error: 'Запрос не найден' });
        
        const senderId = request.recordset[0].sender_id;
        const transaction = pool.transaction();
        
        try {
            await transaction.begin();
            await transaction.request().input('id', sql.Int, requestId).query('UPDATE FriendRequests SET status = \'accepted\' WHERE id = @id');
            await transaction.request().input('user1', sql.Int, userId).input('user2', sql.Int, senderId).query(`IF NOT EXISTS (SELECT 1 FROM Contacts WHERE user_id = @user1 AND contact_id = @user2) INSERT INTO Contacts (user_id, contact_id) VALUES (@user1, @user2)`);
            await transaction.request().input('user1', sql.Int, senderId).input('user2', sql.Int, userId).query(`IF NOT EXISTS (SELECT 1 FROM Contacts WHERE user_id = @user1 AND contact_id = @user2) INSERT INTO Contacts (user_id, contact_id) VALUES (@user1, @user2)`);
            await transaction.commit();
            res.json({ success: true, message: 'Запрос принят' });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friend-requests/:id/decline', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const requestId = parseInt(req.params.id);
        
        const request = await pool.request()
            .input('id', sql.Int, requestId)
            .input('userId', sql.Int, userId)
            .query('SELECT id FROM FriendRequests WHERE id = @id AND receiver_id = @userId AND status = \'pending\'');
        
        if (!request.recordset?.[0]) return res.status(404).json({ error: 'Запрос не найден' });
        
        await pool.request().input('id', sql.Int, requestId).query('UPDATE FriendRequests SET status = \'declined\' WHERE id = @id');
        res.json({ success: true, message: 'Запрос отклонён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friend-requests/:id/cancel', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        const requestId = parseInt(req.params.id);
        
        const request = await pool.request()
            .input('id', sql.Int, requestId)
            .input('userId', sql.Int, userId)
            .query('SELECT id FROM FriendRequests WHERE id = @id AND sender_id = @userId AND status = \'pending\'');
        
        if (!request.recordset?.[0]) return res.status(404).json({ error: 'Запрос не найден' });
        
        await pool.request().input('id', sql.Int, requestId).query('DELETE FROM FriendRequests WHERE id = @id');
        res.json({ success: true, message: 'Запрос отменён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/friend-requests/count', auth, async (req, res) => {
    try {
        const pool = await getConnection();
        const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT COUNT(*) AS count FROM FriendRequests WHERE receiver_id = @userId AND status = \'pending\'');
        
        res.json({ count: result.recordset[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обработчик ошибок

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Ошибка загрузки файла: ' + err.message });
    }
    if (err.message?.includes('Только изображения')) {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + err.message });
});

app.use((req, res) => {
    res.status(404).send(`
        <html><body style="font-family: Arial; text-align: center; margin-top: 50px;">
            <h1>404 - Страница не найдена</h1>
            <a href="/login.html">Вернуться на главную</a>
        </body></html>
    `);
});

// запуск севрера

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
    console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});