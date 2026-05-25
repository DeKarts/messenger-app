const { getConnection, sql } = require('./db');

async function sendMessage(fromUserId, toUsername, text) {
    const pool = await getConnection();
    const toUser = await pool.request()
        .input('identifier', sql.NVarChar, toUsername)
        .query(`
            SELECT id FROM Users 
            WHERE email = @identifier 
               OR phone = @identifier 
               OR username = @identifier
               OR display_name = @identifier
        `);
    
    if (!toUser.recordset || !toUser.recordset[0] || !toUser.recordset[0].id) {
        return { error: 'Получатель не найден' };
    }
    
    const toUserId = toUser.recordset[0].id;
    const fromUserIdInt = typeof fromUserId === 'string' ? parseInt(fromUserId) : fromUserId;
    
    await pool.request()
        .input('from_id', sql.Int, fromUserIdInt)
        .input('to_id', sql.Int, toUserId)
        .input('text', sql.NVarChar, text)
        .query('INSERT INTO Messages (from_user_id, to_user_id, text) VALUES (@from_id, @to_id, @text)');
    
    return { success: true };
}

async function getMessages(userId, otherUsername) {
    const pool = await getConnection();
    
    const other = await pool.request()
        .input('identifier', sql.NVarChar, otherUsername)
        .query(`
            SELECT id, COALESCE(display_name, username, phone, email) AS displayName
            FROM Users 
            WHERE email = @identifier 
               OR phone = @identifier 
               OR username = @identifier
               OR display_name = @identifier
        `);
    
    if (!other.recordset || !other.recordset[0] || !other.recordset[0].id) {
        return [];
    }
    
    const otherId = other.recordset[0].id;
    const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
    
    let result;
    try {
        result = await pool.request()
            .input('user1', sql.Int, userIdInt)
            .input('user2', sql.Int, otherId)
            .query(`
                SELECT 
                    m.id,
                    COALESCE(u_from.display_name, u_from.username, u_from.phone, u_from.email) AS fromUser,
                    COALESCE(u_to.display_name, u_to.username, u_to.phone, u_to.email) AS toUser,
                    m.from_user_id AS fromUserId, m.to_user_id AS toUserId,
                    m.text AS messageText, 
                    m.file_path AS filePath,
                    m.reply_to_id AS replyToId,
                    m.forwarded_message_id AS forwardedMessageId,
                    m.forwarded_sender_name AS forwardedSenderName,
                    FORMAT(m.created_at, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS sentAt,
                    m.deleted_at AS deletedAt,
                    m.is_read AS isRead,
                    orig.text AS replyText,
                    orig.file_path AS replyFilePath,
                    orig.from_user_id AS replyFromUserId,
                    COALESCE(u_orig_from.display_name, u_orig_from.username, u_orig_from.phone, u_orig_from.email) AS replyUsername,
                    COALESCE(u_orig_from.display_name, u_orig_from.username, u_orig_from.phone, u_orig_from.email) AS replyDisplayName,
                    u_orig_from.last_name AS replyLastName,
                    fwd.from_user_id AS forwardedFromUserId,
                    COALESCE(u_fwd_from.display_name, u_fwd_from.username, u_fwd_from.phone, u_fwd_from.email) AS forwardedFromUser,
                    u_fwd_from.last_name AS forwardedLastName
                FROM Messages m
                JOIN Users u_from ON m.from_user_id = u_from.id
                JOIN Users u_to ON m.to_user_id = u_to.id
                LEFT JOIN Messages orig ON m.reply_to_id = orig.id
                LEFT JOIN Users u_orig_from ON orig.from_user_id = u_orig_from.id
                LEFT JOIN Messages fwd ON m.forwarded_message_id = fwd.id
                LEFT JOIN Users u_fwd_from ON fwd.from_user_id = u_fwd_from.id
                WHERE (m.from_user_id = @user1 AND m.to_user_id = @user2)
                   OR (m.from_user_id = @user2 AND m.to_user_id = @user1)
                ORDER BY m.created_at
            `);
    } catch (err) {
        try {
            result = await pool.request()
                .input('user1', sql.Int, userIdInt)
                .input('user2', sql.Int, otherId)
                .query(`
                    SELECT 
                        m.id,
                        COALESCE(u_from.display_name, u_from.username, u_from.phone, u_from.email) AS fromUser,
                        COALESCE(u_to.display_name, u_to.username, u_to.phone, u_to.email) AS toUser,
                        m.from_user_id AS fromUserId, m.to_user_id AS toUserId,
                        m.text AS messageText, 
                        m.file_path AS filePath,
                        m.reply_to_id AS replyToId,
                        m.forwarded_message_id AS forwardedMessageId,
                        m.forwarded_sender_name AS forwardedSenderName,
                        FORMAT(m.created_at, 'yyyy-MM-ddTHH:mm:ss.fff') + '+07:00' AS sentAt,
                        m.deleted_at AS deletedAt,
                        orig.text AS replyText,
                        orig.file_path AS replyFilePath,
                        orig.from_user_id AS replyFromUserId,
                        COALESCE(u_orig_from.display_name, u_orig_from.username, u_orig_from.phone, u_orig_from.email) AS replyUsername,
                        COALESCE(u_orig_from.display_name, u_orig_from.username, u_orig_from.phone, u_orig_from.email) AS replyDisplayName,
                        u_orig_from.last_name AS replyLastName,
                        fwd.from_user_id AS forwardedFromUserId,
                        COALESCE(u_fwd_from.display_name, u_fwd_from.username, u_fwd_from.phone, u_fwd_from.email) AS forwardedFromUser,
                        u_fwd_from.last_name AS forwardedLastName,
                        NULL AS isRead
                    FROM Messages m
                    JOIN Users u_from ON m.from_user_id = u_from.id
                    JOIN Users u_to ON m.to_user_id = u_to.id
                    LEFT JOIN Messages orig ON m.reply_to_id = orig.id
                    LEFT JOIN Users u_orig_from ON orig.from_user_id = u_orig_from.id
                    LEFT JOIN Messages fwd ON m.forwarded_message_id = fwd.id
                    LEFT JOIN Users u_fwd_from ON fwd.from_user_id = u_fwd_from.id
                    WHERE (m.from_user_id = @user1 AND m.to_user_id = @user2)
                       OR (m.from_user_id = @user2 AND m.to_user_id = @user1)
                    ORDER BY m.created_at
                `);
        } catch (err2) {
            throw err2;
        }
    }
    
    const messages = result.recordset.map((row) => {
        const isDeleted = row.deletedAt != null;
        return {
            id: row.id,
            fromUser: row.fromUser,
            toUser: row.toUser,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            messageText: row.messageText,
            filePath: row.filePath,
            replyToId: row.replyToId,
            forwardedMessageId: row.forwardedMessageId,
            forwardedSenderName: row.forwardedSenderName,
            replyText: row.replyText,
            replyFilePath: row.replyFilePath,
            replyFromUserId: row.replyFromUserId,
            replyUsername: row.replyUsername,
            replyDisplayName: row.replyDisplayName,
            replyLastName: row.replyLastName,
            forwardedFromUserId: row.forwardedFromUserId,
            forwardedFromUser: row.forwardedFromUser,
            forwardedLastName: row.forwardedLastName,
            sentAt: row.sentAt ? new Date(row.sentAt) : null,
            isDeleted: isDeleted,
            isRead: row.isRead === true || row.isRead === 1
        };
    });
    
    const deletedCount = messages.filter(m => m.isDeleted).length;
    return messages;
}

async function deleteMessage(messageId, userId) {
    const pool = await getConnection();
    
    const checkResult = await pool.request()
        .input('messageId', sql.Int, messageId)
        .input('userId', sql.Int, userId)
        .query('SELECT from_user_id FROM Messages WHERE id = @messageId');
    
    if (!checkResult.recordset || checkResult.recordset.length === 0) {
        return { error: 'Сообщение не найдено' };
    }
    
    if (checkResult.recordset[0].from_user_id !== userId) {
        return { error: 'Можно удалять только свои сообщения' };
    }
    
    try {
        await pool.request()
            .input('messageId', sql.Int, messageId)
            .query('UPDATE Messages SET deleted_at = GETDATE() WHERE id = @messageId');
    } catch (err) {
        await pool.request()
            .input('messageId', sql.Int, messageId)
            .query('DELETE FROM Messages WHERE id = @messageId');
    }
    
    return { success: true };
}

async function editMessage(messageId, userId, newText) {
    const pool = await getConnection();
    
    const checkResult = await pool.request()
        .input('messageId', sql.Int, messageId)
        .input('userId', sql.Int, userId)
        .query('SELECT from_user_id FROM Messages WHERE id = @messageId');
    
    if (!checkResult.recordset || checkResult.recordset.length === 0) {
        return { error: 'Сообщение не найдено' };
    }
    
    if (checkResult.recordset[0].from_user_id !== userId) {
        return { error: 'Можно редактировать только свои сообщения' };
    }
    
    await pool.request()
        .input('messageId', sql.Int, messageId)
        .input('text', sql.NVarChar, newText)
        .query('UPDATE Messages SET text = @text, edited_at = GETDATE() WHERE id = @messageId');
    
    return { success: true };
}

async function sendFileMessage(fromUserId, toUserId, text, filePaths, forwardedMessageId = null, forwardSenderName = null, forwardSenderLastName = null, forwardOriginalText = null) {
    const pool = await getConnection();
    const fromUserIdInt = typeof fromUserId === 'string' ? parseInt(fromUserId) : fromUserId;
    
    for (const filePath of filePaths) {
        let finalText = text || '';
        
        if (forwardedMessageId && filePath) {
            const fileName = filePath.split('/').pop().toLowerCase();
            if (fileName.endsWith('.webm') || fileName.endsWith('.mp3') || fileName.endsWith('.m4a')) {
                finalText = 'Пересланное сообщение';
            } else {
                finalText = 'Файл';
            }
        } else if (forwardedMessageId && forwardOriginalText && forwardOriginalText.trim()) {
            finalText = forwardOriginalText;
        }
        
        let query = 'INSERT INTO Messages (from_user_id, to_user_id, text, file_path';
        let values = 'VALUES (@from_id, @to_id, @text, @file_path';
        
        if (forwardedMessageId) {
            query += ', forwarded_message_id, forwarded_sender_name';
            values += ', @forwarded_message_id, @forward_sender_name';
        }
        
        query += ') ' + values + ')';
        
        await pool.request()
            .input('from_id', sql.Int, fromUserIdInt)
            .input('to_id', sql.Int, toUserId)
            .input('text', sql.NVarChar, finalText)
            .input('file_path', sql.NVarChar, filePath)
            .input('forwarded_message_id', sql.Int, forwardedMessageId || null)
            .input('forward_sender_name', sql.NVarChar, forwardSenderName || null)
            .query(query);
    }
    
    return { success: true };
}

async function forwardMessage(fromUserId, toUsername, originalMessageId, forwardedSenderName, forwardOriginalText, forwardedSenderLastName) {
    const pool = await getConnection();
    
    const originalMessage = await pool.request()
        .input('messageId', sql.Int, originalMessageId)
        .query('SELECT from_user_id, to_user_id, text, file_path FROM Messages WHERE id = @messageId');
    
    if (!originalMessage.recordset || originalMessage.recordset.length === 0) {
        return { error: 'Оригинальное сообщение не найдено' };
    }
    
    const originalMsg = originalMessage.recordset[0];
    
    const toUser = await pool.request()
        .input('identifier', sql.NVarChar, toUsername)
        .query(`
            SELECT id FROM Users 
            WHERE email = @identifier 
               OR phone = @identifier 
               OR username = @identifier
               OR display_name = @identifier
        `);
    
    if (!toUser.recordset || !toUser.recordset[0] || !toUser.recordset[0].id) {
        return { error: 'Получатель не найден' };
    }
    
    const toUserId = toUser.recordset[0].id;
    const fromUserIdInt = typeof fromUserId === 'string' ? parseInt(fromUserId) : fromUserId;
    
    if (!forwardedSenderName || !forwardedSenderName.trim()) {
        return { error: 'Пересылаемое сообщение должно содержать имя отправителя' };
    }
    
    let finalText = 'Пересланное сообщение';
    
    if (originalMsg.file_path) {
        const fileName = originalMsg.file_path.split('/').pop().toLowerCase();
        if (fileName.endsWith('.webm') || fileName.endsWith('.mp3') || fileName.endsWith('.m4a')) {
            finalText = 'Пересланное сообщение';
        } else {
            finalText = 'Файл';
        }
    } else if (forwardOriginalText && forwardOriginalText.trim()) {
        finalText = forwardOriginalText;
    } else if (originalMsg.text && originalMsg.text.trim()) {
        finalText = originalMsg.text;
    }
    const fullSenderName = forwardedSenderName;
    
    await pool.request()
        .input('from_id', sql.Int, fromUserIdInt)
        .input('to_id', sql.Int, toUserId)
        .input('text', sql.NVarChar, finalText)
        .input('file_path', sql.NVarChar, originalMsg.file_path || '')
        .input('forwarded_message_id', sql.Int, originalMessageId)
        .input('forwarded_sender_name', sql.NVarChar, fullSenderName)
        .query('INSERT INTO Messages (from_user_id, to_user_id, text, file_path, forwarded_message_id, forwarded_sender_name) VALUES (@from_id, @to_id, @text, @file_path, @forwarded_message_id, @forwarded_sender_name)');

    return { success: true };
}

async function replyMessage(fromUserId, toUsername, text, replyToMessageId) {
    const pool = await getConnection();
    
    const originalMessage = await pool.request()
        .input('messageId', sql.Int, replyToMessageId)
        .query('SELECT from_user_id, to_user_id, text, file_path FROM Messages WHERE id = @messageId');
    
    if (!originalMessage.recordset || originalMessage.recordset.length === 0) {
        return { error: 'Оригинальное сообщение не найдено' };
    }
    
    const toUser = await pool.request()
        .input('identifier', sql.NVarChar, toUsername)
        .query(`
            SELECT id FROM Users 
            WHERE email = @identifier 
               OR phone = @identifier 
               OR username = @identifier
               OR display_name = @identifier
        `);
    
    if (!toUser.recordset || !toUser.recordset[0] || !toUser.recordset[0].id) {
        return { error: 'Получатель не найден' };
    }
    
    const toUserId = toUser.recordset[0].id;
    const fromUserIdInt = typeof fromUserId === 'string' ? parseInt(fromUserId) : fromUserId;
    
    await pool.request()
        .input('from_id', sql.Int, fromUserIdInt)
        .input('to_id', sql.Int, toUserId)
        .input('text', sql.NVarChar, text)
        .input('reply_to_id', sql.Int, replyToMessageId)
        .query('INSERT INTO Messages (from_user_id, to_user_id, text, reply_to_id) VALUES (@from_id, @to_id, @text, @reply_to_id)');
    
    return { success: true };
}

async function getUnreadCounts(userId) {
    const pool = await getConnection();
    const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
    
    try {
        const result = await pool.request()
            .input('userId', sql.Int, userIdInt)
            .query(`
                SELECT m.from_user_id AS contactId, COUNT(*) AS count
                FROM Messages m
                WHERE m.to_user_id = @userId
                  AND (m.is_read = 0 OR m.is_read IS NULL)
                  AND m.deleted_at IS NULL
                GROUP BY m.from_user_id
            `);
        
        const counts = {};
        result.recordset.forEach(row => {
            counts[row.contactId] = row.count;
        });
        return counts;
    } catch (err) {
        return {};
    }
}

async function markMessagesAsRead(userId, fromUserId) {
    const pool = await getConnection();
    const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
    const fromUserIdInt = typeof fromUserId === 'string' ? parseInt(fromUserId) : fromUserId;
    
    try {
        await pool.request()
            .input('userId', sql.Int, userIdInt)
            .input('fromId', sql.Int, fromUserIdInt)
            .query(`
                UPDATE Messages
                SET is_read = 1
                WHERE to_user_id = @userId
                  AND from_user_id = @fromId
                  AND (is_read = 0 OR is_read IS NULL)
            `);
        return { success: true };
    } catch (err) {
        return { success: true };
    }
}

module.exports = { sendMessage, getMessages, deleteMessage, editMessage, sendFileMessage, forwardMessage, replyMessage, getUnreadCounts, markMessagesAsRead };