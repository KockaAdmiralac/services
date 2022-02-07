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
    cleanup() {
        return this.bot.welcome.cleanup();
    }
}

class Welcome {
    constructor(bot) {
        Object.defineProperty(this, 'bot', { value: bot });
        Object.defineProperty(this, 'config', { value: bot.config.WELCOME });
        this.db = new Database(this.config.DB);
        bot.listen('guildMemberAdd', this.onJoin, this);
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
        const bans = await guild.bans.fetch();
        for (const discordId of await this.db.getUsersByFandomIds(fandomIds)) {
            if (bans.has(discordId)) {
                return true;
            }
        }
        return false;
    }

    async reportBan(member, fandomIds) {
        if (this.config.NOTIFY_BAN) {
            const channel = await member.guild.channels.cache.get(this.config.NOTIFY_BAN);
            if (channel) {
                return channel.send(`Banning <@${member.id}> as they are associated with Fandom accounts that were banned from the server (${fandomIds.join(', ')}).`);
            }
        }
    }

    async onJoin(member) {
        const fandomIds = await this.db.getUserByDiscordId(member.user.id);
        const channel = member.guild.channels.cache.get(this.config.CHANNEL);
        if (fandomIds.length) {
            // User already verified
            if (await this.isBannedFromServer(fandomIds, member.guild)) {
                // User was banned from the server on another account
                await this.reportBan(member, fandomIds);
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
        return channel.send(this.formatMessage(this.config.MESSAGE, member));
    }

    cleanup() {
        return this.db.cleanup();
    }
}

module.exports = WelcomePlugin;
