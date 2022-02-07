/**
 * siadd.js
 *
 * Adds a user to the SI database/
 */
'use strict';

const twinklePath = process.argv[2];
const ModCommand = require(`${twinklePath}/src/plugins/commander/structs/ModCommand.js`);
const SIBaza = require('../../util/si-db.js');
const {SlashCommandBuilder} = require('@discordjs/builders');

class SIAddCommand extends ModCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['siadd', 'sia'];
        this.shortdesc = 'Adds a person to the SI database.';
        this.desc = 'Adds specified semicolon-delimited information about a person to the SI database.';
        this.schema = new SlashCommandBuilder()
            .addIntegerOption(option => option
                .setName('godina')
                .setDescription('Godina upisa studenta')
                .setRequired(true)
            )
            .addIntegerOption(option => option
                .setName('indeks')
                .setDescription('Broj indeksa studenta')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('ime')
                .setDescription('Ime studenta, obavezno ћирилицом!')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('prezime')
                .setDescription('Prezime studenta, obavezno ћирилицом!')
                .setRequired(true)
            )
            .addUserOption(option => option
                .setName('discord')
                .setDescription('Discord profil studenta')
            )
            .addIntegerOption(option => option
                .setName('telefon')
                .setDescription('Broj telefona studenta')
            );
        this.usages = [
            '!siadd 2010;0001;Име;Презиме;148231501413089280',
            '!sia 2010;0001;Име;Презиме',
            '!sia 2010;0001;Име;Презиме;148231501413089280;381641234567'
        ];
        this.db = new SIBaza(bot.config.SI);
    }

    async call(message, content, {interaction}) {
        let year;
        let index;
        let firstName;
        let lastName;
        let discordID = null;
        let phone = null;
        if (interaction) {
            const {options} = interaction;
            year = options.getInteger('godina', true);
            index = options.getInteger('indeks', true);
            firstName = options.getString('ime', true);
            lastName = options.getString('prezime', true);
            const user = options.getUser('discord');
            if (user) {
                discordID = BigInt(user.id);
            }
            phone = options.getInteger('telefon');
        } else {
            const spl = content.split(';');
            if (spl.length < 4 || spl.length > 6) {
                return message.channel.send('Preveliki ili premali broj `;`.');
            }
            let yearStr;
            let indexStr;
            let discordIDStr;
            let phoneNumberStr;
            [yearStr, indexStr, firstName, lastName, discordIDStr, phoneNumberStr] = spl;
            year = Number(yearStr);
            index = Number(indexStr);
            firstName = firstName.trim();
            lastName = lastName.trim();
            if (isNaN(year) || isNaN(index)) {
                return message.channel.send('Godina ili indeks nisu validno formirani.');
            }
            if (phoneNumberStr) {
                phone = Number(phoneNumberStr);
                if (isNaN(phone)) {
                    return message.channel.send('Broj telefona nije validno formiran.');
                }
            }
            try {
                if (discordIDStr) {
                    discordID = BigInt(discordIDStr);
                }
            } catch {
                return message.channel.send('Discord ID nije validno formiran.');
            }
        }
        if (await this.db.getStudent(year, index)) {
            return message.channel.send('Student sa tim indeksom je već zabeležen.');
        }
        if (await this.db.getStudentByDiscordID(discordID)) {
            return message.channel.send('Student sa tim Discord nalogom je već zabeležen.');
        }
        await this.db.addStudent(year, index, lastName, firstName, discordID);
        if (phone) {
            await this.db.addPhoneNumber(year, index, phone);
        }
        return message.channel.send('Zabeležen.');
    }

    cleanup() {
        return this.db.cleanup();
    }
};

module.exports = SIAddCommand;
