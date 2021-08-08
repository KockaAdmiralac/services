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
        if ((await this.getUserByDiscordId(discordId)).includes(fandomId)) {
            return false;
        }
        await this.db.execute(
            'INSERT INTO `discord_fandom_mapping` (`discord_id`, `fandom_id`) VALUES (?, ?)',
            [discordId, fandomId]
        );
        return true;
    }
    async getUserByDiscordId(discordId) {
        return (await this.db.execute(
            'SELECT `fandom_id` FROM `discord_fandom_mapping` WHERE `discord_id` = ?',
            [discordId]
        ))[0].map(row => row.fandom_id);
    }
    async getUserByFandomId(fandomId) {
        return (await this.db.execute(
            'SELECT CAST(`discord_id` AS VARCHAR(255)) AS `discord_id` FROM `discord_fandom_mapping` WHERE `fandom_id` = ?',
            [fandomId]
        ))[0].map(row => row.discord_id);
    }
    async getUsersByFandomIds(fandomIds) {
        return (await this.db.execute(
            'SELECT CAST(`discord_id` AS VARCHAR(255)) AS `discord_id` FROM `discord_fandom_mapping` WHERE ' +
            fandomIds.map(() => '`fandom_id` = ?').join(' OR '),
            fandomIds
        ))[0].map(row => row.discord_id);
    }
    cleanup() {
        return this.db.end();
    }
}

module.exports = Database;
