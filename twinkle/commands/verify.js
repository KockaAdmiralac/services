/**
 * verify.js
 *
 * A modification of the !member command, more suited for use on wikis with
 * gated verification channels.
 *
 * Undertale Wiki (https://ut.wikia.com) is currently hardcoded.
 */
const twinklePath = process.argv[2];
const Command = require(`${twinklePath}/src/plugins/commander/structs/Command.js`);
const {WebhookClient} = require('discord.js');
const got = require('got');
const {SlashCommandBuilder} = require('@discordjs/builders');

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
        this.schema = new SlashCommandBuilder()
            .addStringOption(option => option
                .setName('username')
                .setDescription('Your Fandom username')
                .setRequired(true)
            );
        if (this.bot.welcome && this.bot.welcome.config.WEBHOOK) {
            const {ID, TOKEN} = this.bot.welcome.config.WEBHOOK;
            this.webhook = new WebhookClient({
                id: ID,
                token: TOKEN
            });
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
            embeds: [{
                color: 0xFF0000,
                description,
                title: 'Verification Error'
            }]
        });
    }

    verificationStep(message, description) {
        return message.channel.send({
            embeds: [{
                color: 0x00FF00,
                description,
                title: 'One More Step'
            }]
        });
    }

    async call(message, content, {interaction}) {
        // Only allow verification from the verification channel
        if (this.bot.welcome && this.bot.welcome.config.CHANNEL !== message.channel.id) {
            if (interaction) {
                await interaction.reply({
                    content: 'You are already verified.',
                    ephemeral: true
                });
            }
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

        // User literally typed in "<your Fandom username>"
        if (username.toLowerCase().includes('your fandom username')) {
            return this.verificationError(message, 'Please replace `<your Fandom username>` with your actual Fandom username and rerun the command.');
        }

        // User specified an invalid username
        if (username.match(INVALID_CHARACTERS)) {
            return this.verificationError(message, 'The username you posted contains invalid characters and cannot be registered on Fandom. Please double-check whether your username is right.');
        }

        const userId = await this.getUserId(username);

        if (!userId) {
            return this.verificationError(message, 'That user does not exist on Fandom. Check [here](https://undertale.fandom.com/wiki/Special:MyPage) to see which user are you currently logged in as, or [here](https://fandom.com/signup) to sign up for a new Fandom account. Fandom usernames are case-sensitive!');
        }

        const discordTag = await this.getMastheadDiscord(userId);
        const verificationLink = `https://undertale.fandom.com/wiki/Special:VerifyUser/${encodeURIComponent(username)}?user=${encodeURIComponent(message.author.username)}&useskin=fandomdesktop`;
        if (!discordTag) {
            return this.verificationStep(message, `The user ${username} does not have their username set in their profile masthead. Please set it [here](<${verificationLink}>) and re-run this command.`);
        }
        if (message.author.username !== discordTag.toLowerCase().replace(/#\d+$/g, '')) {
            return this.verificationStep(message, `The username and tag in the masthead do not match the username and tag of the message author. Click [here](<${verificationLink}>) to remedy this.`);
        }

        if (this.bot.welcome) {
            if (await this.bot.welcome.isBlockedFromWiki(userId)) {
                return this.verificationError(message, 'Your account is currently blocked from the wiki.');
            }
            if (await this.bot.welcome.isBannedFromServer([userId], message.guild)) {
                await this.bot.welcome.db.addUser(message.author.id, userId);
                await this.bot.welcome.reportBan(message.member, [userId]);
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
            if (interaction) {
                await interaction.reply({
                    embeds: [{
                        color: 0x00FF00,
                        description: 'Head out to other channels for conversation.',
                        title: 'Verification successful!'
                    }],
                    ephemeral: true
                })
            }
            if (this.webhook) {
                // Post the username in a logging channel
                return this.webhook.send(`<@${message.author.id}> - [${username}](<https://undertale.fandom.com/wiki/User:${encodeURIComponent(username)}>)`);
            }
        }
    }

    cleanup() {
        this.webhook.destroy();
    }
}

module.exports = VerifyCommand;
