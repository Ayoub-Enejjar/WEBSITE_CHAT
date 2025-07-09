// User model for MongoDB
import bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';

class User {
    constructor(db) {
        this.collection = db.collection('users');
    }

    async createTable() {
        // No need to create table in MongoDB, collections are created automatically
        return true;
    }

    async findByUsername(username) {
        return this.collection.findOne({ username: username.toLowerCase() });
    }

    async findByCustomId(customId) {
        return this.collection.findOne({ customId });
    }

    async findById(id) {
        return this.collection.findOne({ _id: new ObjectId(id) });
    }

    async create(userData) {
        const result = await this.collection.insertOne({
            ...userData,
            username: userData.username.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return result.insertedId;
    }

    async updateProfilePic(userId, profilePicPath) {
        return this.collection.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    profilePic: profilePicPath,
                    updatedAt: new Date()
                }
            }
        );
    }

    async verifyPassword(user, password) {
        return await bcrypt.compare(password, user.password);
    }

    async updateUser(userId, updateData) {
        return this.collection.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    ...updateData,
                    updatedAt: new Date()
                }
            }
        );
    }

    async deleteUser(userId) {
        return this.collection.deleteOne({ _id: new ObjectId(userId) });
    }
}

export default User;
