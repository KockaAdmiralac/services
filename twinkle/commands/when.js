/**
 * when.js
 *
 * Tells you the % of time that elapsed between the release of Deltarune
 * Chapter 1 and the date 7 years after, estimated by Toby Fox to be the
 * maximum amount of time he is willing to spend on a project.
 *
 * Rumia asked for this.
 */
const twinklePath = process.argv[2];
const Command = require(`${twinklePath}/src/plugins/commander/structs/Command.js`);
const {SlashCommandBuilder} = require("@discordjs/builders");

class DeltaruneWhenCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['deltarunewhen', 'when', 'deltarune', 'rumiaaskedforthis'];
        this.shortdesc = 'When is Deltarune coming out?';
        this.desc = 'Tells you the % of time that elapsed between 2018-10-31 and 2025-10-31.';
        this.usages = ['!when'];
        this.schema = new SlashCommandBuilder();
        this.startDate = new Date('2018-10-31');
        this.endDate = new Date('2025-10-31');
    }
    call(message) {
        return message.channel.send(`${Math.round((new Date() - this.startDate) / (this.endDate - this.startDate) * 10000) / 100}%`);
    }
}

module.exports = DeltaruneWhenCommand;
