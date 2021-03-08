/**
 * verify.js
 *
 * A modification of the !member command, more suited for use on wikis with
 * gated verification channels.
 *
 * Undertale Wiki (https://ut.wikia.com) is currently hardcoded.
 */
const twinklePath = process.argv[2],
      Command = require(`${twinklePath}/src/plugins/commander/structs/Command.js`),
      {WebhookClient} = require('discord.js'),
      got = require('got');

const INVALID_CHARACTERS = /[#<>[\]:\{\}]/u;

class VerifyCommand extends Command {
    constructor(bot) {
        super(bot);
        this.aliases = ['verify', 'v'];

        this.shortdesc = `Gives you the member role.`;
        this.desc = `Gives you the member role if don't already have it.`;
        this.usages = [
            '!verify wiki-username'
        ];
        if (this.bot.welcome && this.bot.welcome.config.WEBHOOK) {
            const webhook = this.bot.welcome.config.WEBHOOK;
            this.webhook = new WebhookClient(webhook.ID, webhook.TOKEN);
        }
    }

    async getUserId(username) {
        const response = await got('https://community.fandom.com/api.php', {
            searchParams: {
                action: 'query',
                list: 'users',
                ususers: username,
                format: 'json'
            }
        }).json();
        if (response.query.users[0]) {
            return response.query.users[0].userid;
        }
    }

    async getMastheadDiscord(userId) {
        try {
            const response = await got(`https://services.fandom.com/user-attribute/user/${userId}/attr/discordHandle`, {
                headers: {
                    accept: '*/*'
                },
                searchParams: {
                    cb: Date.now()
                }
            }).json();
            return response.value;
        } catch (error) {
            if (error && error.response && error.response.statusCode === 404) {
                return;
            }
            throw error;
        }
    }

    verificationError(message, description) {
        return message.channel.send({
            embed: {
                color: 0xFF0000,
                description,
                title: 'Verification Error'
            }
        });
    }

    verificationStep(message, description) {
        return message.channel.send({
            embed: {
                color: 0x00FF00,
                description,
                title: 'One More Step'
            }
        });
    }

    async call(message, content) {
        // Only allow verification from the verification channel
        if (this.bot.welcome && this.bot.welcome.config.CHANNEL !== message.channel.id) {
            return;
        }
        // User did not specify a username
        if (!content) {
            return this.verificationError(message, 'You did not specify a username. Please use the command as `!verify <your Fandom username>`');
        }
        const username = content.replace(/^<?([^>]+)>?$/, '$1');

        // User specified a username with '@' in it
        if (username.includes('@')) {
            return this.verificationError(message, 'Usernames on Fandom can\'t contain `@` in them. Please post _only_ your Fandom username, without @mentions of any kind.');
        }
        // User specified an invalid username
        if (username.match(INVALID_CHARACTERS)) {
            return this.verificationError(message, 'The username you posted contains invalid characters and cannot be registered on Fandom. Please double-check whether your username is right.');
        }

        const userId = await this.getUserId(username);

        if (!userId) {
            return this.verificationError(message, 'That user does not exist on Fandom.');
        }

        const discordTag = await this.getMastheadDiscord(userId),
              verificationLink = `https://undertale.fandom.com/wiki/Special:VerifyUser/${encodeURIComponent(username)}?user=${encodeURIComponent(message.author.username)}&tag=${message.author.discriminator}&ch=post_your_username_here`;
        if (!discordTag) {
            return this.verificationStep(message, `The user ${username} does not have their username set in their profile masthead. Please set it [here](<${verificationLink}>) and re-run this command.`);
        }
        if (discordTag.trim() !== message.author.tag) {
            return this.verificationStep(message, `The username and tag in the masthead do not match the username and tag of the message author. Click [here](<${verificationLink}>) to remedy this.`);
        }

        if (this.bot.welcome) {
            if (await this.bot.welcome.isBlockedFromWiki(userId)) {
                return this.verificationError(message, 'Your account is currently blocked from the wiki.');
            }
            if (await this.bot.welcome.isBannedFromServer([userId], message.guild)) {
                await this.bot.welcome.db.addUser(message.author.id, userId);
                return message.member.ban({
                    reason: 'Verified with an account that was previously banned from the server.'
                });
            }
            await message.member.roles.add(this.bot.welcome.config.ROLE);
            if (!await this.bot.welcome.db.addUser(message.author.id, userId)) {
                // User already exists in database
                return;
            }
            if (this.bot.welcome.config.FIRST_MESSAGE) {
                // Clear messages until the first
                const messages = await message.channel.messages.fetch({
                    after: this.bot.welcome.config.FIRST_MESSAGE
                });
                await message.channel.bulkDelete(messages.map(m => m.id));
            }
            if (this.webhook) {
                // Post the username in a logging channel
                this.webhook.send(`<@${message.author.id}> - [${username}](<https://undertale.fandom.com/wiki/User:${encodeURIComponent(username)}>)`);
            }
        }
    }
}

module.exports = VerifyCommand;
