/**
 * siadd.js
 *
 * Adds a user to the SI database/
 */
'use strict';

const twinklePath = process.argv[2],
      ModCommand = require(`${twinklePath}/src/plugins/commander/structs/ModCommand.js`),
      SIBaza = require('../../util/si-db.js');

class SIAddCommand extends ModCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['siadd', 'sia'];
        this.shortdesc = 'Adds a person to the SI database.';
        this.desc = 'Adds specified semicolon-delimited information about a person to the SI database.';
        this.usages = [
            '!siadd 2010;0001;Име;Презиме;148231501413089280',
            '!sia 2010;0001;Име;Презиме'
        ];
        this.db = new SIBaza(bot.config.SI);
    }

    async call(message, content) {
        const spl = content.split(';');
        if (spl.length < 4 || spl.length > 5) {
            return message.channel.send('Preveliki ili premali broj `;`.');
        }
        let discordID = null;
        const [yearStr, indexStr, firstName, lastName, discordIDStr] = spl,
              year = Number(yearStr),
              index = Number(indexStr);
        if (isNaN(year) || isNaN(index)) {
            return message.channel.send('Godina ili indeks nisu validno formirani.');
        }
        try {
            if (discordIDStr) {
                discordID = BigInt(discordIDStr);
            }
        } catch {
            return message.channel.send('Discord ID nije validno formiran.');
        }
        await this.db.addStudent(year, index, lastName, firstName, discordID);
        message.channel.send('Zabeležen.');
    }
};

module.exports = SIAddCommand;
