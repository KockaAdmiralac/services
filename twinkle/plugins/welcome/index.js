/**
 * index.js
 *
 * A stripped-down version of the joinleave plugin, used for automatically
 * assigning roles to users on joining and greeting them if they haven't
 * joined before.
 */
const twinklePath = process.argv[2],
      Plugin = require(`${twinklePath}/src/structs/Plugin.js`),
      Database = require('./db.js');

class WelcomePlugin extends Plugin {
    load() {
        this.bot.welcome = new Welcome(this.bot);
    }
}

class Welcome {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config.WELCOME;
        this.db = new Database(this.config.DB);
        bot.client.on('guildMemberAdd', this.onJoin.bind(this));
    }

    getVars(member) {
        return {
            USERID: member.user.id,
            USERNAME: member.user.username,
            USERDISCRIM: member.user.discriminator
        };
    }

    formatMessage(message, member) {
        const vars = this.getVars(member);
        return message.replace(/\$([A-Z]+)/g, (full, name) => {
            if (vars[name]) {
                return vars[name];
            }

            return full;
        });
    }

    async onJoin(member) {
        if (await this.db.getUser(member.user.id)) {
            // User already verified
            return member.roles.add(this.config.ROLE);
        }
        const channel = member.guild.channels.cache.get(this.config.CHANNEL);
        channel.send(this.formatMessage(this.config.MESSAGE, member));
    }
}

module.exports = WelcomePlugin;
