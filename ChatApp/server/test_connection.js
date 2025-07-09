import { MongoClient, ServerApiVersion } from 'mongodb';

// Using the connection string from MongoDB Atlas
const uri = "mongodb+srv://ayoubcomp24:sSCIQYT9xnen7lIv@cluster0.zybv8bt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    connectTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000,  // 45 seconds
    maxPoolSize: 50,
    minPoolSize: 10,
    retryWrites: true,
    retryReads: true,
    heartbeatFrequencyMS: 10000,
    serverSelectionTimeoutMS: 30000,
    family: 4 // Force IPv4
});

async function run() {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds

    const attemptConnection = async () => {
        try {
            console.log('🔄 Starting MongoDB connection test...');
            console.log('Connection URI:', uri.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
            
            console.log('Establishing connection...');
            await client.connect();
            console.log('Connection established');
            
            // Send a ping to confirm a successful connection
            console.log('Sending ping to verify connection...');
            await client.db("admin").command({ ping: 1 });
            console.log("✅ Successfully connected to MongoDB!");
            
            // Test database operations
            console.log('Testing database operations...');
            const db = client.db("Cluster0");
            const collections = await db.listCollections().toArray();
            console.log("📊 Available collections:", collections.map(c => c.name));
            
            return true;
        } catch (error) {
            console.error('❌ MongoDB connection error:', error);
            
            if (error.name === 'MongoServerError' && error.code === 8000) {
                console.error('\nAuthentication failed. Please check:');
                console.error('1. Your MongoDB Atlas username and password');
                console.error('2. Go to MongoDB Atlas:');
                console.error('   a. Click "Database Access"');
                console.error('   b. Find your user');
                console.error('   c. Click "Edit"');
                console.error('   d. Click "Edit Password"');
                console.error('   e. Set a new password');
                console.error('   f. Update the connection string with the new password');
            } else if (error.name === 'MongoServerSelectionError') {
                console.error('\nConnection failed. Please check:');
                console.error('1. Your internet connection');
                console.error('2. MongoDB Atlas Network Access:');
                console.error('   a. Go to "Network Access"');
                console.error('   b. Look for the IP confirmation request');
                console.error('   c. Click "Confirm" to allow access from your current IP');
                console.error('   d. Wait 1-2 minutes for changes to propagate');
            }

            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying connection (attempt ${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return attemptConnection();
            }
            
            return false;
        } finally {
            console.log('Closing connection...');
            await client.close();
            console.log('Connection closed');
        }
    };

    const success = await attemptConnection();
    if (!success) {
        console.error('Failed to connect after multiple attempts');
        process.exit(1);
    }
}

// Run the test
run().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
