const mysql = require('mysql2/promise');

class Database {
    constructor(config) {
        this.db = mysql.createPool({
            host: config && config.HOST || 'localhost',
            user: config && config.USER || 'twinkle',
            password: config && config.PASSWORD,
            database: config && config.DATABASE || 'twinkle',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    async addUser(discordId, fandomId) {
        if (await this.getUser(discordId) === fandomId) {
            return false;
        }
        await this.db.execute(
            'INSERT INTO `discord_fandom_mapping` (`discord_id`, `fandom_id`) VALUES (?, ?)',
            [discordId, fandomId]
        );
        return true;
    }
    async getUser(discordId) {
        const row = (await this.db.execute(
            'SELECT `fandom_id` FROM `discord_fandom_mapping` WHERE `discord_id` = ?',
            [discordId]
        ))[0][0];
        if (row) {
            return row.fandom_id;
        }
    }
}

module.exports = Database;
