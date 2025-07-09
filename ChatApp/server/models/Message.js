// Message model for MongoDB
import { ObjectId } from 'mongodb';

class Message {
    constructor(db) {
        this.collection = db.collection('messages');
    }

    async createTable() {
        // No need to create table in MongoDB, collections are created automatically
        return true;
    }

    async create(messageData) {
        const result = await this.collection.insertOne({
            ...messageData,
            sender: new ObjectId(messageData.sender),
            recipient: messageData.recipient ? new ObjectId(messageData.recipient) : null,
            createdAt: new Date(),
            isRead: false,
            isDelivered: false
        });
        return result.insertedId;
    }

    async getMessagesBetweenUsers(userId1, userId2) {
        return this.collection.find({
            $or: [
                { sender: new ObjectId(userId1), recipient: new ObjectId(userId2) },
                { sender: new ObjectId(userId2), recipient: new ObjectId(userId1) }
            ]
        }).sort({ createdAt: 1 }).toArray();
    }

    async getConversations(userId) {
        const currentUserId = new ObjectId(userId);
        const pipeline = [
            {
                $match: {
                    $or: [
                        { sender: currentUserId },
                        { recipient: currentUserId }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 } // Trier par date de création du message
            },
            {
                $group: {
                    _id: { // Regrouper par l'autre utilisateur de la conversation
                        $cond: [
                            { $eq: ["$sender", currentUserId] },
                            "$recipient",
                            "$sender"
                        ]
                    },
                    lastMessageDoc: { $first: "$$ROOT" } // Prendre le document entier du dernier message
                }
            },
            // S'assurer que _id (l'ID de l'autre utilisateur) n'est pas null (cas des messages globaux)
            {
                $match: { "_id": { $ne: null } }
            },
            {
                $lookup: { // Joindre avec la collection users pour obtenir les détails de l'autre utilisateur
                    from: "users",
                    localField: "_id", // _id ici est l'ID de l'autre utilisateur
                    foreignField: "_id",
                    as: "partnerInfo"
                }
            },
            {
                $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: false } // On s'attend à un seul partenaire
            },
            // Calculer le nombre de messages non lus de ce partenaire envers l'utilisateur actuel
            {
                $lookup: {
                    from: "messages",
                    let: { partner_id: "$partnerInfo._id", user_id: currentUserId },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$sender", "$$partner_id"] },
                                        { $eq: ["$recipient", "$$user_id"] },
                                        { $eq: ["$isRead", false] }
                                    ]
                                }
                            }
                        },
                        { $count: "count" }
                    ],
                    as: "unreadMessages"
                }
            },
            {
                $project: {
                    _id: 0, // Ne pas inclure le _id du groupe
                    id: "$partnerInfo._id", // ID de l'autre utilisateur
                    username: "$partnerInfo.username",
                    customId: "$partnerInfo.customId",
                    profilePic: "$partnerInfo.profilePic",
                    lastMessage: { // Détails du dernier message échangé
                        _id: "$lastMessageDoc._id",
                        sender: "$lastMessageDoc.sender",
                        recipient: "$lastMessageDoc.recipient",
                        content: "$lastMessageDoc.content",
                        timestamp: "$lastMessageDoc.createdAt", // Utiliser createdAt
                        fileAttachment: "$lastMessageDoc.fileAttachment",
                        audioFile: "$lastMessageDoc.audioFile",
                        isRead: "$lastMessageDoc.isRead",
                        isSentByMe: { $eq: ["$lastMessageDoc.sender", currentUserId] }
                    },
                    // Obtenir le compte des messages non lus ou 0 s'il n'y en a pas
                    unreadCount: { $ifNull: [{ $arrayElemAt: ["$unreadMessages.count", 0] }, 0] }
                }
            },
            {
                $sort: { "lastMessage.timestamp": -1 } // Trier les conversations par le timestamp du dernier message
            }
        ];

        try {
            const conversations = await this.collection.aggregate(pipeline).toArray();
            return conversations;
        } catch (error) {
            console.error("Error in Message.getConversations pipeline:", error);
            throw error; // Propager l'erreur pour que la route API la gère
        }
    }

    async markAsDelivered(messageId, userId) {
        return this.collection.updateOne(
            { _id: new ObjectId(messageId), recipient: new ObjectId(userId) },
            { $set: { isDelivered: true } }
        );
    }

    async markAsRead(messageId, userId) {
        return this.collection.updateOne(
            { _id: new ObjectId(messageId), recipient: new ObjectId(userId) },
            { $set: { isRead: true } }
        );
    }

    async findById(messageId) {
        return this.collection.findOne({ _id: new ObjectId(messageId) });
    }
}

export default Message;
