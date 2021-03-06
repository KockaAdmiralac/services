/**
 * index.js
 *
 * A stripped-down version of the joinleave plugin, used for automatically
 * assigning roles to users on joining and greeting them if they haven't
 * joined before.
 */
const twinklePath = process.argv[2],
      Plugin = require(`${twinklePath}/src/structs/Plugin.js`),
      SIBaza = require('../../../util/si-db.js');

class AutorolePlugin extends Plugin {
    load() {
        this.bot.autorole = new Autorole(this.bot);
    }
}

class Autorole {
    constructor(bot) {
        this.bot = bot;
        this.db = new SIBaza(bot.config.SI);
        bot.client.on('guildMemberAdd', this.onJoin.bind(this));
    }

    async onJoin(member) {
        for (const role of await this.db.getRolesForUser(member.user.id)) {
            await member.roles.add(role);
        }
    }
}

module.exports = AutorolePlugin;
