/**
 * index.js
 *
 * A stripped-down version of the joinleave plugin, used for automatically
 * assigning roles to users on joining and greeting them if they haven't
 * joined before.
 */
const twinklePath = process.argv[2];
const Plugin = require(`${twinklePath}/src/structs/Plugin.js`);
const SIBaza = require('../../../util/si-db.js');

class AutorolePlugin extends Plugin {
    load() {
        this.bot.autorole = new Autorole(this.bot);
    }
    cleanup() {
        return this.bot.autorole.cleanup();
    }
}

class Autorole {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });
        this.db = new SIBaza(bot.config.SI);
        bot.listen('guildMemberAdd', this.onJoin, this);
    }

    async onJoin(member) {
        for (const role of await this.db.getRolesForUser(member.user.id)) {
            await member.roles.add(role);
        }
    }

    cleanup() {
        return this.db.cleanup();
    }
}

module.exports = AutorolePlugin;
