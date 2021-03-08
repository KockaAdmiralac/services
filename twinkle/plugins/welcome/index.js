/**
 * index.js
 *
 * A stripped-down version of the joinleave plugin, used for automatically
 * assigning roles to users on joining and greeting them if they haven't
 * joined before.
 */
const twinklePath = process.argv[2],
      Plugin = require(`${twinklePath}/src/structs/Plugin.js`),
      Database = require('./db.js'),
      got = require('got');

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

    async isBlockedFromWiki(userId) {
        const response = await got('https://undertale.fandom.com/wikia.php', {
            searchParams: {
                controller: 'UserProfile',
                format: 'json',
                method: 'getUserData',
                // 'Blocked' should not be localized
                uselang: 'en',
                userId
            }
        }).json();
        return response && response.userData &&
               response.userData.tags instanceof Array &&
               response.userData.tags.includes('Blocked');
    }

    async isBannedFromServer(fandomIds, guild) {
        const bans = await guild.fetchBans();
        for (const discordId of await this.db.getUsersByFandomIds(fandomIds)) {
            if (bans.has(discordId)) {
                return true;
            }
        }
        return false;
    }

    async onJoin(member) {
        const fandomIds = await this.db.getUserByDiscordId(member.user.id);
        const channel = member.guild.channels.cache.get(this.config.CHANNEL);
        if (fandomIds.length) {
            // User already verified
            if (await this.isBannedFromServer(fandomIds, member.guild)) {
                // User was banned from the server on another account
                return member.ban({
                    reason: 'Verified with an account that was previously banned from the server.'
                });
            }
            for (const fandomId of fandomIds) {
                if (await this.isBlockedFromWiki(fandomId)) {
                    // User is blocked from the wiki
                    return channel.send(this.formatMessage(this.config.BLOCKED, member));
                }
            }
            return member.roles.add(this.config.ROLE);
        }
        channel.send(this.formatMessage(this.config.MESSAGE, member));
    }
}

module.exports = WelcomePlugin;
