// Message model for MySQL
class Message {
    constructor(db) {
        this.db = db;
    }

    async create(messageData) {
        const { sender, recipient, content, fileAttachment, audioFile } = messageData;
        const [result] = await this.db.execute(
            'INSERT INTO messages (senderId, recipientId, content, fileAttachment, audioFile, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
            [
                sender, 
                recipient || null, 
                content, 
                fileAttachment ? JSON.stringify(fileAttachment) : null, 
                audioFile ? JSON.stringify(audioFile) : null
            ]
        );
        return result.insertId;
    }

    async getMessagesBetweenUsers(userId1, userId2) {
        const query = `
            SELECT m.*, u.username as senderUsername, u.customId as senderCustomId, u.profilePic as senderProfilePic
            FROM messages m
            JOIN users u ON m.senderId = u.id
            WHERE (m.senderId = ? AND m.recipientId = ?) 
               OR (m.senderId = ? AND m.recipientId = ?)
            ORDER BY m.createdAt ASC
        `;
        const [rows] = await this.db.execute(query, [userId1, userId2, userId2, userId1]);
        
        // Parse JSON fields
        return rows.map(msg => ({
            ...msg,
            _id: msg.id, // For compatibility
            sender: msg.senderId,
            recipient: msg.recipientId,
            fileAttachment: typeof msg.fileAttachment === 'string' ? JSON.parse(msg.fileAttachment) : msg.fileAttachment,
            audioFile: typeof msg.audioFile === 'string' ? JSON.parse(msg.audioFile) : msg.audioFile,
            isRead: !!msg.isRead,
            isDelivered: !!msg.isDelivered,
            senderProfile: {
                id: msg.senderId,
                username: msg.senderUsername,
                customId: msg.senderCustomId,
                profilePic: msg.senderProfilePic || 'assets/default-avatar.png'
            }
        }));
    }

    async getConversations(userId) {
        const query = `
            SELECT 
                u.id, 
                u.username, 
                u.customId, 
                u.profilePic,
                m.content AS lastMessageContent,
                m.createdAt AS lastMessageTimestamp,
                m.isRead AS lastMessageIsRead,
                m.fileAttachment AS lastMessageFileAttachment,
                m.audioFile AS lastMessageAudioFile,
                (m.senderId = ?) AS lastMessageIsSentByMe,
                (SELECT COUNT(*) FROM messages 
                 WHERE senderId = u.id AND recipientId = ? AND isRead = FALSE) AS unreadCount
            FROM (
                SELECT MAX(id) as max_id
                FROM messages
                WHERE (senderId = ? OR recipientId = ?)
                GROUP BY CASE 
                    WHEN senderId = ? THEN recipientId 
                    ELSE senderId 
                END
            ) as last_msg_ids
            JOIN messages m ON m.id = last_msg_ids.max_id
            JOIN users u ON u.id = CASE WHEN m.senderId = ? THEN m.recipientId ELSE m.senderId END
            WHERE u.id IS NOT NULL
            ORDER BY m.createdAt DESC
        `;
        
        const [rows] = await this.db.execute(query, [userId, userId, userId, userId, userId, userId]);
        
        return rows.map(conv => ({
            id: conv.id,
            username: conv.username,
            customId: conv.customId,
            profilePic: conv.profilePic,
            lastMessage: {
                content: conv.lastMessageContent,
                timestamp: conv.lastMessageTimestamp,
                isRead: !!conv.lastMessageIsRead,
                isSentByMe: !!conv.lastMessageIsSentByMe,
                fileAttachment: typeof conv.lastMessageFileAttachment === 'string' ? JSON.parse(conv.lastMessageFileAttachment) : conv.lastMessageFileAttachment,
                audioFile: typeof conv.lastMessageAudioFile === 'string' ? JSON.parse(conv.lastMessageAudioFile) : conv.lastMessageAudioFile
            },
            unreadCount: conv.unreadCount
        }));
    }

    async markAsDelivered(messageId, userId) {
        return this.db.execute(
            'UPDATE messages SET isDelivered = TRUE WHERE id = ? AND recipientId = ?',
            [messageId, userId]
        );
    }

    async markAsRead(messageId, userId) {
        return this.db.execute(
            'UPDATE messages SET isRead = TRUE WHERE id = ? AND recipientId = ?',
            [messageId, userId]
        );
    }

    async findById(messageId) {
        const query = `
            SELECT m.*, u.username as senderUsername, u.customId as senderCustomId, u.profilePic as senderProfilePic
            FROM messages m
            JOIN users u ON m.senderId = u.id
            WHERE m.id = ?
        `;
        const [rows] = await this.db.execute(query, [messageId]);
        const msg = rows[0];
        if (!msg) return null;
        
        return {
            ...msg,
            id: msg.id,
            _id: msg.id,
            sender: msg.senderId,
            recipient: msg.recipientId,
            fileAttachment: typeof msg.fileAttachment === 'string' ? JSON.parse(msg.fileAttachment) : msg.fileAttachment,
            audioFile: typeof msg.audioFile === 'string' ? JSON.parse(msg.audioFile) : msg.audioFile,
            senderProfile: {
                id: msg.senderId,
                username: msg.senderUsername,
                customId: msg.senderCustomId,
                profilePic: msg.senderProfilePic || 'assets/default-avatar.png'
            }
        };
    }
}

export default Message;
