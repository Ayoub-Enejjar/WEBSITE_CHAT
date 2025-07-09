// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase, client, db, User, Message } from './database.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3001;

const clientPath = join(__dirname, '..', 'client');
const UPLOADS_DIR = join(clientPath, 'uploads');
const AVATARS_SUBDIR = 'avatars';
const FILES_SUBDIR = 'chatfiles';

// Ensure upload directories exist
const AVATARS_PATH = join(UPLOADS_DIR, AVATARS_SUBDIR);
const FILES_PATH = join(UPLOADS_DIR, FILES_SUBDIR);
const AUDIO_PATH = join(UPLOADS_DIR, 'audio');

[UPLOADS_DIR, AVATARS_PATH, FILES_PATH, AUDIO_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Initialize database and models
let userModel, messageModel;

// Make database initialization async
async function startServer() {
    try {
        // Initialize database first
        await initializeDatabase();
        
        // Create model instances
        userModel = new User(db);
        messageModel = new Message(db);
        
        console.log("✅ Database and models initialized successfully");
        
        // Start the server
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`🌐 Access the application at: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Failed to initialize database:', err);
        process.exit(1);
    }
}

// Start the server
startServer();

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'kamehameha-super-secret-CHANGE-THIS-VERY-MUCH-AND-MAKE-IT-LONG-AND-RANDOM',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        httpOnly: true, 
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
});

app.use(sessionMiddleware);
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// --- State (active users) ---
let activeUsers = {}; // { socketId: { id, username, customId, profilePic } }

// --- Helper function ---
function getClientReadyActiveUsers() {
    const uniqueUserMap = new Map();
    Object.values(activeUsers).forEach(user => {
        if (user && user.id) { 
            uniqueUserMap.set(user.id, {
                id: user.id,
                username: user.username,
                customId: user.customId,
                profilePic: user.profilePic
            });
        }
    });
    return Array.from(uniqueUserMap.values());
}

// --- Multer Config ---
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATARS_PATH),
    filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4().slice(0, 8) + '-' + Date.now();
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

const avatarFileFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files (JPG, JPEG, PNG, GIF) are allowed!'), false);
    }
    cb(null, true);
};

const uploadAvatarRegistration = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: avatarFileFilter }).single('profilePic');
const uploadAvatarEdit = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: avatarFileFilter }).single('newProfilePic');

const chatFileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, FILES_PATH),
    filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4().slice(0, 8) + '-' + Date.now();
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase());
    }
});

const uploadChatFile = multer({ storage: chatFileStorage, limits: { fileSize: 10 * 1024 * 1024 } }).single('chatFile');

// Configure multer for audio file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, AUDIO_PATH);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// --- Define API Routes ---
const apiRouter = express.Router();

// Registration endpoint
apiRouter.post('/register', (req, res) => {
    uploadAvatarRegistration(req, res, async (uploadErr) => {
        if (uploadErr) {
            console.error("[Auth][Register] Upload error:", uploadErr);
            return res.status(400).json({ message: uploadErr.message || "Avatar upload failed." });
        }
        
        const { username, password, customId } = req.body;
        console.log("[Auth][Register] Attempting to register user:", { username, customId });
        
        if (!username || !password || !customId || username.length < 2 || password.length < 4) {
            return res.status(400).json({ message: 'Username (min 2), Password (min 4), and ID (3-10 chars) required.' });
        }
        
        if (customId.length < 3 || customId.length > 10 || !/^[a-zA-Z0-9_]+$/.test(customId)) {
            return res.status(400).json({ message: 'ID must be 3-10 alphanumeric characters.' });
        }
        
        try {
            // Ensure database is connected
            if (!db) {
                throw new Error('Database not connected');
            }

            const profilePicFilename = req.file ? req.file.filename : null;
            
            // Check if username or customId already exists
            const existingUserByUsername = await userModel.findByUsername(username);
            const existingUserByCustomId = await userModel.findByCustomId(customId);
            
            if (existingUserByUsername) {
                console.log("[Auth][Register] Username already exists:", username);
                return res.status(409).json({ message: 'Username already exists.' });
            }
            
            if (existingUserByCustomId) {
                console.log("[Auth][Register] Custom ID already taken:", customId);
                return res.status(409).json({ message: 'ID already taken.' });
            }
            
            // Hash the password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            
            // Insert new user
            const userId = await userModel.create({
                username: username.toLowerCase(),
                password: passwordHash,
                customId,
                profilePic: profilePicFilename ? `/uploads/avatars/${profilePicFilename}` : null,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            console.log("[Auth][Register] Successfully registered user:", username);
            res.status(201).json({ 
                message: 'Registered! Please log in.', 
                userId,
                user: {
                    username,
                    customId,
                    profilePic: profilePicFilename ? `/uploads/avatars/${profilePicFilename}` : null
                }
            });
        } catch (error) {
            console.error("[Auth][Register] Error:", error);
            // Clean up uploaded file if registration fails
            if (req.file) {
                const filePath = path.join(AVATARS_PATH, req.file.filename);
                fs.unlink(filePath, (err) => {
                    if (err) console.error("[Auth][Register] Error deleting failed upload:", err);
                });
            }
            res.status(500).json({ 
                message: 'Server registration error: ' + error.message,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
});

// Login endpoint
apiRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log("[Auth][Login] Attempting login for:", username);
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required.' });
    }
    
    try {
        // Ensure database is connected
        if (!db) {
            throw new Error('Database not connected');
        }

        // Find user by username (case insensitive)
        const user = await userModel.findByUsername(username.toLowerCase());
        console.log("[Auth][Login] User lookup result:", user ? "User found" : "User not found");
        
        if (!user) {
            console.log("[Auth][Login] User not found:", username);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        
        // Compare password
        const passwordMatch = await userModel.verifyPassword(user, password);
        console.log("[Auth][Login] Password verification result:", passwordMatch ? "Match" : "No match");
        
        if (!passwordMatch) {
            console.log("[Auth][Login] Invalid password for user:", username);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        
        // Set user session
        req.session.userId = user._id;
        req.session.user = {
            id: user._id,
            username: user.username,
            customId: user.customId,
            profilePic: user.profilePic || 'assets/default-avatar.png'
        };
            
        console.log("[Auth][Login] Successfully logged in user:", username);
        res.json({ 
            message: 'Logged in successfully!',
            user: {
                id: user._id,
                username: user.username,
                customId: user.customId,
                profilePic: user.profilePic || 'assets/default-avatar.png'
            }
        });
    } catch (error) {
        console.error("[Auth][Login] Error:", error);
        res.status(500).json({ 
            message: 'Server login error: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Logout endpoint
apiRouter.post('/logout', (req, res) => {
    if (req.session && req.session.userId) {
        const username = req.session.user.username;
        req.session.destroy((err) => {
            if (err) {
                console.error('[Auth][Logout] Error destroying session:', err);
                return res.status(500).json({ message: 'Logout failed.' });
            }
            console.log(`[Auth][Logout] User: ${username} logged out.`);
            res.clearCookie('connect.sid');
            res.json({ message: 'Logout successful' });
        });
    } else {
        res.status(400).json({ message: 'Not logged in.' });
    }
});

// Check authentication endpoint
apiRouter.get('/check-auth', async (req, res) => {
    if (req.session && req.session.userId) {
        try {
            const user = await userModel.findById(req.session.userId);
            if (user) {
                req.session.user = {
                    id: user._id,
                    username: user.username,
                    customId: user.customId,
                    profilePic: user.profilePic
                };
                return res.json({ isAuthenticated: true, user: req.session.user });
            }
            req.session = null;
        } catch (error) {
            console.error('[Auth][CheckAuth] Error:', error);
            res.status(500).json({ message: 'Server error checking authentication.' });
        }
    }
    res.json({ isAuthenticated: false });
});

// Update profile picture endpoint
apiRouter.post('/update-profile-pic', (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized." });
    uploadAvatarEdit(req, res, async (uploadErr) => {
        if (uploadErr) return res.status(400).json({ message: uploadErr.message || "Avatar update failed." });
        if (!req.file) return res.status(400).json({ message: "No new picture." });
        try {
            // Get current user
            const user = await userModel.findById(req.session.user.id);
            if (!user) return res.status(404).json({ message: "User not found." });

            // Delete old profile picture if it exists
            if (user.profilePic) {
                const oldPicPath = path.join(AVATARS_PATH, path.basename(user.profilePic));
                fs.unlink(oldPicPath, (err) => {
                    if (err && err.code !== 'ENOENT') console.error(`Error deleting old pic: ${oldPicPath}`, err);
                });
            }

            // Update user profile pic
            const newPicPath = `/uploads/avatars/${req.file.filename}`;
            await userModel.updateProfilePic(req.session.user.id, newPicPath);

            // Update session and active users
            req.session.user.profilePic = newPicPath;
            Object.keys(activeUsers).forEach(sid => {
                if (activeUsers[sid].id === req.session.user.id) {
                    activeUsers[sid].profilePic = newPicPath;
                }
            });

            io.emit('update user list', getClientReadyActiveUsers());
            res.json({ message: "Pic updated!", newProfilePicPath: newPicPath });
        } catch (error) {
            console.error('[Profile] Error updating profile pic:', error);
            res.status(500).json({ message: "Server error updating profile pic." });
        }
    });
});

// File upload endpoint
apiRouter.post('/messages/upload', (req, res) => {
    if (!req.session.user) {
        console.warn('[ChatFile] Upload attempt without authentication');
        return res.status(401).json({ message: "Unauthorized" });
    }

    uploadChatFile(req, res, async (uploadErr) => {
        if (uploadErr) {
            console.error("[ChatFile] Upload error:", uploadErr.message);
            return res.status(400).json({ message: uploadErr.message || "File upload failed" });
        }

        if (!req.file) {
            console.warn("[ChatFile] No file provided in upload request");
            return res.status(400).json({ message: "No file provided" });
        }

        try {
            const fileUrl = `/uploads/${FILES_SUBDIR}/${req.file.filename}`;
            const fileInfo = {
                url: fileUrl,
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size
            };

            console.log(`[ChatFile] Processing file upload: ${fileInfo.name} (${fileInfo.size} bytes)`);

            const messageId = await messageModel.create({
                sender: new ObjectId(req.session.user.id),
                recipient: req.body.recipientId ? new ObjectId(req.body.recipientId) : null,
                content: req.body.message || '',
                fileAttachment: fileInfo,
                audioFile: null,
                timestamp: new Date()
            });

            console.log(`[ChatFile] Saved new file message from ${req.session.user.username}, messageId: ${messageId}`);

            const senderProfile = {
                id: req.session.user.id,
                username: req.session.user.username,
                customId: req.session.user.customId,
                profilePic: req.session.user.profilePic
            };

            const messageData = {
                _id: messageId.toString(),
                sender: req.session.user.id,
                recipient: req.body.recipientId,
                content: req.body.message || '',
                fileAttachment: fileInfo,
                timestamp: new Date(),
                isPrivate: !!req.body.recipientId,
                senderProfile: senderProfile
            };

            if (req.body.recipientId) {
                const recipientSockets = Object.entries(activeUsers)
                    .filter(([_, user]) => user.id === req.body.recipientId)
                    .map(([socketId, _]) => socketId);

                if (recipientSockets.length > 0) {
                    recipientSockets.forEach(sockId => {
                        io.to(sockId).emit('private message received', messageData);
                    });
                    console.log(`[ChatFile] Sent file to recipient ${req.body.recipientId}`);
                } else {
                    console.log(`[ChatFile] Recipient ${req.body.recipientId} is offline`);
                }

                const senderSockets = Object.entries(activeUsers)
                    .filter(([_, user]) => user.id === req.session.user.id)
                    .map(([socketId, _]) => socketId);

                senderSockets.forEach(sockId => {
                    io.to(sockId).emit('message confirmed', messageData);
                });
            } else {
                io.emit('chat message', {
                    id: req.session.user.id,
                    username: req.session.user.username,
                    text: req.body.message || '',
                    fileAttachment: fileInfo,
                    timestamp: new Date(),
                    isPrivate: false,
                    senderProfile: senderProfile
                });
                console.log(`[ChatFile] Broadcasted file message to all users`);
            }

            res.json({ message: "File uploaded successfully", file: fileInfo, messageId: messageId });
        } catch (error) {
            console.error("[ChatFile] Error saving file message:", error);
            if (req.file && req.file.path) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("[ChatFile] Error deleting failed upload:", err);
                });
            }
            res.status(500).json({ message: "Server error saving file message" });
        }
    });
});

// Add audio upload endpoint
apiRouter.post('/messages/audio', upload.single('audioFile'), async (req, res) => {
    if (!req.session.user) {
        console.warn('[Audio] Upload attempt without authentication');
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("[Audio] Error deleting unauthenticated audio upload:", err);
            });
        }
        return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const senderId = req.session.user.id;
    const { recipientId } = req.body;

    if (!recipientId) {
        console.warn('[Audio] Upload attempt without recipient ID');
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("[Audio] Error deleting audio upload with missing recipientId:", err);
            });
        }
        return res.status(400).json({ message: "Recipient ID is required." });
    }

    if (!req.file) {
        console.warn('[Audio] No audio file provided in upload request');
        return res.status(400).json({ message: "No audio file provided." });
    }

    try {
        console.log(`[Audio] Processing audio upload from ${req.session.user.username} to ${recipientId}`);

        const fileUrl = `/uploads/audio/${req.file.filename}`;
        const audioInfo = {
            url: fileUrl,
            name: req.file.originalname || req.file.filename,
            type: req.file.mimetype,
            size: req.file.size,
            duration: req.body.duration || 0
        };

        console.log(`[Audio] Audio file info:`, audioInfo);

        const messageId = await messageModel.create({
            sender: new ObjectId(senderId),
            recipient: new ObjectId(recipientId),
            content: '[Audio Message]',
            fileAttachment: null,
            audioFile: audioInfo,
            timestamp: new Date()
        });

        console.log(`[Audio] Saved new audio message with ID: ${messageId}`);

        const senderProfile = {
            id: req.session.user.id,
            username: req.session.user.username,
            customId: req.session.user.customId,
            profilePic: req.session.user.profilePic
        };

        const messageData = {
            _id: messageId.toString(),
            sender: senderId,
            recipient: recipientId,
            content: '[Audio Message]',
            audioFile: audioInfo,
            timestamp: new Date(),
            isPrivate: true,
            senderProfile: senderProfile
        };

        const recipientSockets = Object.entries(activeUsers)
            .filter(([_, user]) => user.id === recipientId)
            .map(([socketId, _]) => socketId);

        if (recipientSockets.length > 0) {
            recipientSockets.forEach(sockId => {
                io.to(sockId).emit('private message received', messageData);
            });
            console.log(`[Audio] Emitted audio message to recipient socket: ${recipientSockets.join(', ')}`);
        } else {
            console.log(`[Audio] Recipient ${recipientId} is offline. Message saved for later delivery.`);
        }

        const senderSockets = Object.entries(activeUsers)
            .filter(([_, user]) => user.id === senderId)
            .map(([socketId, _]) => socketId);

        senderSockets.forEach(sockId => {
            io.to(sockId).emit('message confirmed', messageData);
        });

        console.log(`[Audio] Audio message successfully processed and saved`);
        res.json({
            message: "Audio message sent successfully",
            fileUrl: fileUrl,
            messageId: messageId,
            audioInfo: audioInfo
        });
    } catch (error) {
        console.error('[Audio] Error processing audio message:', error);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("[Audio] Error deleting failed audio upload:", err);
            });
        }
        res.status(500).json({ message: 'Server error sending audio message.' });
    }
});

// Get conversations endpoint
apiRouter.get('/conversations', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    const userId = req.session.user.id;
    console.log(`[Server][Conversations] Attempting to fetch conversations for user ID: ${userId}`);

    try {
        // La méthode getConversations retourne déjà un format assez proche de ce dont le client a besoin
        const rawConversations = await messageModel.getConversations(userId);

        // Le mappage est toujours utile pour s'assurer que le format est exactement ce que le client attend
        // et pour ajouter des valeurs par défaut comme pour profilePic.
        const formattedConversations = rawConversations.map(conv => ({
            id: conv.id.toString(), // Assurez-vous que les ID sont des chaînes
            username: conv.username,
            customId: conv.customId,
            profilePic: conv.profilePic || 'assets/default-avatar.png',
            lastMessage: {
                content: conv.lastMessage.content,
                timestamp: conv.lastMessage.timestamp, // Doit être une date/chaîne ISO valide
                isRead: conv.lastMessage.isRead,
                isSentByMe: conv.lastMessage.isSentByMe,
                fileAttachment: conv.lastMessage.fileAttachment,
                audioFile: conv.lastMessage.audioFile
            },
            unreadCount: conv.unreadCount
        }));

        console.log(`[Server][Conversations] Found ${formattedConversations.length} conversations for user ${userId}.`);
        res.json(formattedConversations);
    } catch (error) {
        console.error(`[Server][Conversations] Error fetching conversations for user ${userId}:`, error);
        res.status(500).json({ message: "Server error fetching conversations.", error: error.message });
    }
});;

// Message endpoints
apiRouter.post('/messages', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const { content, recipientId } = req.body;

    if (!content || !recipientId) {
        return res.status(400).json({ message: 'Content and recipient ID required' });
    }

    try {
        const messageId = await messageModel.create({
            sender: new ObjectId(req.session.user.id),
            recipient: new ObjectId(recipientId),
            content: content,
            timestamp: new Date()
        });

        const message = await messageModel.findById(messageId);
        const formattedMessage = {
            id: message._id,
            sender: message.sender,
            recipient: message.recipient,
            content: message.content,
            timestamp: message.timestamp,
            senderProfile: {
                id: message.sender,
                username: message.senderUsername,
                customId: message.senderCustomId,
                profilePic: message.senderProfilePic
            }
        };

        res.status(201).json(formattedMessage);
    } catch (error) {
        console.error('[Messages] Error creating message:', error);
        res.status(500).json({ message: 'Error creating message' });
    }
});

apiRouter.get('/messages', async (req, res) => { // Changé de '/messages/:userId' à '/messages'
    if (!req.session.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const targetUserId = req.query.with; // Utiliser req.query.with
    const currentUserId = req.session.user.id;

    if (!targetUserId) {
        return res.status(400).json({ message: 'Target user ID ("with" query parameter) is required.' });
    }

    try {
        const messagesFromDb = await messageModel.getMessagesBetweenUsers(currentUserId, targetUserId);

        const formattedMessages = await Promise.all(messagesFromDb.map(async (message) => {
            let senderProfileData = { // Fallback
                id: message.sender.toString(),
                username: 'Unknown User',
                customId: 'N/A',
                profilePic: 'assets/default-avatar.png'
            };
            // Essayer de récupérer le profil de l'expéditeur
            if (message.sender) {
                const senderUser = await userModel.findById(message.sender.toString());
                if (senderUser) {
                    senderProfileData = {
                        id: senderUser._id.toString(),
                        username: senderUser.username,
                        customId: senderUser.customId,
                        profilePic: senderUser.profilePic || 'assets/default-avatar.png'
                    };
                }
            }

            return {
                _id: message._id.toString(), // Important pour le dataset.timestamp côté client
                sender: message.sender.toString(),
                recipient: message.recipient ? message.recipient.toString() : null,
                content: message.content,
                timestamp: message.createdAt, // MongoDB utilise createdAt, le client s'attend à timestamp
                fileAttachment: message.fileAttachment,
                audioFile: message.audioFile,
                isRead: message.isRead,
                senderProfile: senderProfileData
            };
        }));


        res.json(formattedMessages);
    } catch (error) {
        console.error('[Messages] Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
});

// Update message status (delivered/read)
apiRouter.patch('/messages/:messageId/status', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const { messageId } = req.params;
    const { status } = req.body;

    if (!['delivered', 'read'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const message = await messageModel.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        await messageModel.markAsDelivered(messageId, req.session.user.id);
        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        console.error('[Messages] Error updating message status:', error);
        res.status(500).json({ message: 'Error updating message status' });
    }
});

// Mount the API router
app.use('/api', apiRouter);

// --- Serve static files ---
app.use('/uploads', express.static(join(clientPath, 'uploads')));
app.use('/uploads/audio', express.static(join(clientPath, 'uploads', 'audio')));
app.use('/uploads/avatars', express.static(join(clientPath, 'uploads', 'avatars')));
app.use('/uploads/chatfiles', express.static(join(clientPath, 'uploads', 'chatfiles')));
app.use('/assets', express.static(join(clientPath, 'assets')));
app.use('/css', express.static(join(clientPath, 'css')));
app.use('/js', express.static(join(clientPath, 'js')));
app.use('/favicon.ico', express.static(join(clientPath, 'assets', 'favicon.ico')));
app.use(express.static(path.join(__dirname, '../client'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
    },
    acceptRanges: true,
    maxAge: '1h'
}));

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    console.log('[Socket] New connection attempt');

    if (!socket.request.session.user) {
        console.warn('[Socket] Connection rejected: No session user');
        socket.disconnect();
        return;
    }

    const user = socket.request.session.user;
    console.log(`[Socket] User connected: ${user.username} (${user.id})`);

    activeUsers[socket.id] = {
        id: user.id,
        username: user.username,
        customId: user.customId,
        profilePic: user.profilePic
    };

    io.emit('update user list', getClientReadyActiveUsers());

    socket.on('search user', async (customId) => {
        console.log(`[Socket][Search] Received search request for custom ID: ${customId}`);
        console.log(`[Socket][Search] Current session user:`, socket.request.session.user);

        if (!customId) {
            socket.emit('user not found', { message: 'Search query is empty.' });
            return;
        }

        try {
            const foundUser = await userModel.findByCustomId(customId);
            console.log(`[Socket][Search] Found user:`, foundUser);

            if (foundUser) {
                if (socket.request.session.user && foundUser._id.toString() === socket.request.session.user.id) {
                    console.log(`[Socket][Search] User attempted to search for themselves: ${foundUser.username}`);
                    console.log(`[Socket][Search] Session user ID: ${socket.request.session.user.id}, Found user ID: ${foundUser._id}`);
                    socket.emit('user not found', { message: "You can't start a chat with yourself!" });
                    return;
                }

                console.log(`[Socket][Search] User found: ${foundUser.username}`);
                socket.emit('user found', {
                    id: foundUser._id,
                    username: foundUser.username,
                    customId: foundUser.customId,
                    profilePic: foundUser.profilePic || 'assets/default-avatar.png'
                });
            } else {
                console.log(`[Socket][Search] User with custom ID ${customId} not found.`);
                socket.emit('user not found', { message: 'User not found.' });
            }
        } catch (error) {
            console.error(`[Socket][Search] Error searching for user with custom ID ${customId}:`, error);
            socket.emit('user not found', { message: 'Server error during search.' });
        }
    });

    socket.on('private message', async (data) => {
        const { recipientId, message } = data;
        const sender = socket.request.session.user;

        if (!sender || !sender.id) {
            console.warn('[Server][PM] Attempted to send private message without sender session user');
            socket.emit('error', { message: 'Unauthorized to send message' });
            return;
        }

        console.log(`[Server][PM] Processing PM from ${sender.username} to ${recipientId}`);

        try {
            const messageId = await messageModel.create({
                sender: new ObjectId(sender.id),
                recipient: new ObjectId(recipientId),
                content: message,
                timestamp: new Date()
            });

            const savedMessage = await messageModel.findById(messageId);
            const messageData = {
                id: savedMessage._id,
                sender: savedMessage.sender,
                recipient: savedMessage.recipient,
                content: savedMessage.content,
                timestamp: savedMessage.timestamp,
                senderProfile: {
                    id: savedMessage.sender,
                    username: savedMessage.senderUsername,
                    customId: savedMessage.senderCustomId,
                    profilePic: savedMessage.senderProfilePic
                }
            };

            socket.emit('message confirmed', messageData);

            const recipientSockets = Object.entries(activeUsers)
                .filter(([_, user]) => user.id === recipientId)
                .map(([socketId, _]) => socketId);

            if (recipientSockets.length > 0) {
                recipientSockets.forEach(sockId => {
                    io.to(sockId).emit('private message received', messageData);
                });
                console.log(`[Server][PM] Sent PM from ${sender.username} to ${recipientId}. Recipient online.`);
            } else {
                console.log(`[Server][PM] PM from ${sender.username} to ${recipientId}. Recipient offline.`);
            }
        } catch (error) {
            console.error('[Server][PM] Error saving private message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('message delivered', async ({ messageId }) => {
        if (!socket.request.session.user) return;
        const userId = socket.request.session.user.id;
        console.log(`[Server][Status] Received message delivered for ID: ${messageId} from user ${userId}`);

        try {
            await messageModel.markAsDelivered(messageId, userId);
            const message = await messageModel.findById(messageId);

            if (message) {
                const senderSockets = Object.entries(activeUsers)
                    .filter(([_, user]) => user.id === message.sender.toString())
                    .map(([socketId, _]) => socketId);

                if (senderSockets.length > 0) {
                    senderSockets.forEach(sockId => {
                        io.to(sockId).emit('message status update', { messageId: message._id.toString(), status: 'delivered' });
                    });
                    console.log(`[Server][Status] Emitted status 'delivered' for ${message._id} to sender.`);
                }
            }
        } catch (error) {
            console.error('[Server][Status] Error updating message status:', error);
            socket.emit('error', { message: 'Failed to update message status' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
        delete activeUsers[socket.id];
        io.emit('update user list', getClientReadyActiveUsers());
    });
});