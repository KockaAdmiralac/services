/**
 * whois.js
 *
 * Queries the SI database for a person.
 */
'use strict';

const twinklePath = process.argv[2];
const ModCommand = require(`${twinklePath}/src/plugins/commander/structs/ModCommand.js`);
const SIBaza = require('../../util/si-db.js');
const {SlashCommandBuilder} = require('@discordjs/builders');

const INDEX_REGEX = /^(\d+)\/(\d+)$/;
const NAME_REGEX = /^(\S+) (\S+)$/;
const SNOWFLAKE_REGEX = /^<?@?!?(\d+)>?$/;

class WhoisCommand extends ModCommand {
    constructor(bot) {
        super(bot);
        this.aliases = ['whois', 'koje'];
        this.shortdesc = 'Queries the SI database.';
        this.desc = 'Queries the SI database for a person and shows their information in an embed.';
        this.usages = [
            '!whois 2020/0001',
            '!whois Име Презиме',
            '!koje <@148231501413089280>',
            '!whois 148231501413089280'
        ];
        this.schema = new SlashCommandBuilder()
            .addStringOption(option => option
                .setName('upit')
                .setDescription('Upit u formatu GGGG/BBBB, Име Презиме (mora ćirilicom) ili @pominjanja korisnika.')
                .setRequired(true)
            );
        this.db = new SIBaza(bot.config.SI);
    }

    extractUser(content) {
        const indexMatch = INDEX_REGEX.exec(content);
        if (indexMatch) {
            return this.db.getStudent(Number(indexMatch[1]), Number(indexMatch[2]));
        }
        const nameMatch = NAME_REGEX.exec(content);
        if (nameMatch) {
            return this.db.getStudentByName(nameMatch[1], nameMatch[2]);
        }
        const snowflakeMatch = SNOWFLAKE_REGEX.exec(content);
        if (snowflakeMatch) {
            return this.db.getStudentByDiscordID(snowflakeMatch[1]);
        }
    }

    async call(message, content) {
        if (!content) {
            return message.channel.send('Ja sam!');
        }
        const user = await this.extractUser(content);
        if (user === null) {
            return message.channel.send('Nema podataka.');
        } else if (!user) {
            return message.channel.send('Nepoznata sintaksa. Pretražite po GGGG/BBBB, Име Презиме ili pominjanju korisnika.');
        }
        return message.channel.send({
            embeds: [{
                color: message.guild.me.displayColor,
                title: `${user.firstName} ${user.lastName}`,
                fields: [
                    {
                        name: 'Indeks',
                        value: `${user.year}/${user.index}`,
                        inline: true
                    },
                    {
                        name: 'Discord',
                        value: user.discordID ?
                            `<@${user.discordID}>` :
                            'Nepoznat',
                        inline: true
                    },
                    {
                        name: 'Broj telefona',
                        value: user.phoneNumbers.length ?
                            user.phoneNumbers
                                .map(pn => `+${pn}`)
                                .join('\n') :
                            'Nepoznat'
                    }
                ]
            }]
        });
    }
}

module.exports = WhoisCommand;
