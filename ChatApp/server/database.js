import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.js';

dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb+srv://ayoubcomp24:sSCIQYT9xnen7lIv@cluster0.zybv8bt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;

async function initializeDatabase() {
    try {
        // Connect the client to the server
        await client.connect();
        
        // Get the database instance - explicitly connect to 'chatapp'
        db = client.db("chatapp");  // Connect to the 'chatapp' database
        
        // Get existing collections
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        // Create collections if they don't exist
        if (!collectionNames.includes('users')) {
            console.log('Creating users collection...');
            await db.createCollection("users");
        }
        
        if (!collectionNames.includes('messages')) {
            console.log('Creating messages collection...');
            await db.createCollection("messages");
        }
        
        // Create indexes (these are idempotent, so no need to check)
        console.log('Creating indexes...');
        await db.collection("users").createIndex({ username: 1 }, { unique: true });
        await db.collection("users").createIndex({ customId: 1 }, { unique: true });
        await db.collection("messages").createIndex({ sender: 1, recipient: 1 });
        await db.collection("messages").createIndex({ createdAt: -1 });
        
        // Initialize models with database connection
        const userModel = new User(db);
        const messageModel = new Message(db);

        // Initialize models (these are now just placeholders for MongoDB)
        // These methods are for schema initialization in SQLite, not needed for MongoDB
        // await userModel.createTable();
        // await messageModel.createTable();
        
        console.log("✅ Connected to MongoDB database: chatapp");
        console.log("✅ Collections and indexes verified");
        return db;
    } catch (error) {
        console.error('❌ Database connection error:', error);
        // Add more detailed error logging
        if (error.name === 'MongoServerError') {
            console.error('MongoDB Server Error:', error.message);
        } else if (error.name === 'MongoNetworkError') {
            console.error('MongoDB Network Error:', error.message);
            console.error('Please check your internet connection and MongoDB Atlas settings');
        }
        throw error;
    }
}

// Export models and connection function
export { initializeDatabase, client, db, User, Message }; 