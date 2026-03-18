import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.js';

dotenv.config();

let db;

async function initializeDatabase() {
    try {
        console.log('Connecting to MySQL...');
        
        // First connect without specifying a database to ensure we can create it if missing
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });

        const dbName = process.env.DB_NAME || 'chatApp_db';
        console.log(`Ensuring database "${dbName}" exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await connection.query(`USE \`${dbName}\``);
        
        db = connection;
        console.log(`✅ Connected to MySQL database: ${dbName}`);

        // Create users table
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                customId VARCHAR(10) UNIQUE,
                profilePic VARCHAR(255),
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;
        await db.execute(createUsersTable);
        console.log('✅ Users table verified');

        // Create messages table
        const createMessagesTable = `
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                senderId INT NOT NULL,
                recipientId INT,
                content TEXT,
                fileAttachment JSON,
                audioFile JSON,
                isRead BOOLEAN DEFAULT FALSE,
                isDelivered BOOLEAN DEFAULT FALSE,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_sender_recipient (senderId, recipientId),
                INDEX idx_created_at (createdAt)
            )
        `;
        await db.execute(createMessagesTable);
        console.log('✅ Messages table verified');

        return db;
    } catch (error) {
        console.error('❌ Database connection/initialization error:', error);
        throw error;
    }
}

export { initializeDatabase, db, User, Message };