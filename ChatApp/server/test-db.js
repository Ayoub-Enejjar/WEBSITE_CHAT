import mysql from 'mysql2/promise';

async function test() {
    const db = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        port: 3308,
        database: 'chatApp_db'
    });

    const [users] = await db.query('SELECT id, username, customId FROM users');
    console.log("USERS:", users);

    process.exit(0);
}
test();
//this work station is for the same 