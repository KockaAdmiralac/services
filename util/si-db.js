const mysql = require('mysql2/promise');

class SIBaza {
    constructor(config) {
        this.db = mysql.createPool({
            host: config.host || 'localhost',
            user: config.user || 'si',
            password: config.password,
            database: config.database || 'si',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    toUser(rows) {
        if (rows.length === 0) {
            return null;
        }
        return {
            firstName: rows[0].first_name,
            lastName: rows[0].last_name,
            discordID: rows[0].discord_id,
            index: rows[0].index,
            year: rows[0].year,
            phoneNumbers: rows.map(r => r.number).filter(Boolean)
        };
    }
    async getStudent(year, index) {
        return this.toUser((await this.db.execute(
            'SELECT s.`index`, s.`year`, CAST(s.`discord_id` AS VARCHAR(255)) AS `discord_id`, s.`last_name`, s.`first_name`, pn.`number`' +
            'FROM `students` s ' +
            'LEFT JOIN `phone_numbers` pn ON s.year = pn.year AND s.index = pn.index ' +
            'WHERE s.`year` = ? AND s.`index` = ?',
            [year, index]
        ))[0]);
    }
    async getStudentByDiscordID(discordID) {
        return this.toUser((await this.db.execute(
            'SELECT s.`index`, s.`year`, CAST(s.`discord_id` AS VARCHAR(255)) AS `discord_id`, s.`last_name`, s.`first_name`, pn.`number`' +
            'FROM `students` s ' +
            'LEFT JOIN `phone_numbers` pn ON s.year = pn.year AND s.index = pn.index ' +
            'WHERE CAST(s.`discord_id` AS VARCHAR(255)) = ?',
            [discordID]
        ))[0]);
    }
    async getStudentByName(firstName, lastName) {
        return this.toUser((await this.db.execute(
            'SELECT s.`index`, s.`year`, CAST(s.`discord_id` AS VARCHAR(255)) AS `discord_id`, s.`last_name`, s.`first_name`, pn.`number`' +
            'FROM `students` s ' +
            'LEFT JOIN `phone_numbers` pn ON s.year = pn.year AND s.index = pn.index ' +
            'WHERE s.`first_name` = ? AND s.`last_name` = ?',
            [firstName, lastName]
        ))[0]);
    }
    async getStudentByPhone(phone) {
        return this.toUser((await this.db.execute(
            'SELECT s.`index`, s.`year`, CAST(s.`discord_id` AS VARCHAR(255)) AS `discord_id`, s.`last_name`, s.`first_name`, pn.`number`' +
            'FROM `phone_numbers` pn ' +
            'JOIN `students` s ON s.year = pn.year AND s.index = pn.index ' +
            'WHERE pn.`number` = ?',
            [phone]
        ))[0]);
    }
    async getAllStudents() {
        return (await this.db.execute(
            'SELECT `index`, `year`, CAST(`discord_id` AS VARCHAR(255)) AS `discord_id`, `last_name`, `first_name` FROM `students`'
        ))[0];
    }
    async addStudent(year, index, lastName, firstName, discordID) {
        await this.db.execute(
            'INSERT INTO `students` (`year`, `index`, `last_name`, `first_name`, `discord_id`) VALUES (?, ?, ?, ?, ?)',
            [year, index, lastName, firstName, discordID]
        );
    }
    async addPhoneNumber(year, index, phone) {
        await this.db.execute(
            'INSERT INTO `phone_numbers` (`number`, `index`, `year`) VALUES (?, ?, ?)',
            [phone, index, year]
        );
    }
    async addPhoneNumberName(firstName, lastName, phone) {
        await this.db.execute(
            'INSERT INTO `phone_numbers` (`index`, `year`, `number`) SELECT `index`, `year`, ? FROM `students` WHERE `first_name` = ? AND `last_name` = ?',
            [phone, firstName, lastName]
        );
    }
    async getRolesForUser(discordID) {
        return (await this.db.execute(
            'SELECT CAST(r.`role_id` AS VARCHAR(255)) AS `role_id` ' +
            'FROM `roles` r ' +
            'JOIN `students` s ON s.`index` = r.`index` AND s.`year` = r.`year` ' +
            'WHERE s.`discord_id` = ?',
            [discordID]
        ))[0].map(row => row.role_id);
    }
    cleanup() {
        return this.db.end();
    }
}

module.exports = SIBaza;
