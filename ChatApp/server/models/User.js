// User model for MySQL
import bcrypt from 'bcrypt';

class User {
    constructor(db) {
        this.db = db;
    }

    async findByUsername(username) {
        const [rows] = await this.db.execute(
            'SELECT * FROM users WHERE LOWER(username) = ?',
            [username.toLowerCase()]
        );
        return rows[0];
    }

    async findByCustomIdOrUsername(searchTerm) {
        const [rows] = await this.db.execute(
            'SELECT * FROM users WHERE LOWER(customId) = LOWER(?) OR LOWER(username) = LOWER(?)',
            [searchTerm, searchTerm]
        );
        return rows[0];
    }

    async findByCustomId(customId) {
        const [rows] = await this.db.execute(
            'SELECT * FROM users WHERE LOWER(customId) = LOWER(?)',
            [customId]
        );
        return rows[0];
    }

    async findById(id) {
        const [rows] = await this.db.execute(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    async create(userData) {
        const { username, password, customId, profilePic } = userData;
        const [result] = await this.db.execute(
            'INSERT INTO users (username, password, customId, profilePic) VALUES (?, ?, ?, ?)',
            [username.toLowerCase(), password, customId, profilePic]
        );
        return result.insertId;
    }

    async updateProfilePic(userId, profilePicPath) {
        return this.db.execute(
            'UPDATE users SET profilePic = ?, updatedAt = NOW() WHERE id = ?',
            [profilePicPath, userId]
        );
    }

    async verifyPassword(user, password) {
        return await bcrypt.compare(password, user.password);
    }

    async updateUser(userId, updateData) {
        const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateData);
        values.push(userId);
        
        return this.db.execute(
            `UPDATE users SET ${fields}, updatedAt = NOW() WHERE id = ?`,
            values
        );
    }

    async deleteUser(userId) {
        return this.db.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
}

export default User;
