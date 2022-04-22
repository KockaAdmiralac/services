/**
 * main.js
 *
 * Main script of the relay.
 */
'use strict';

/**
 * Importing modules.
 */
const {rename, writeFile} = require('fs/promises'),
      {WebhookClient} = require('discord.js'),
      FileType = require('file-type'),
      {hostname} = require('os'),
      {Client, LocalAuth} = require('whatsapp-web.js'),
      qrcode = require('qrcode-terminal'),
      PQueue = require('p-queue').default,
      Cache = require('./cache.js'),
      Group = require('./group.js'),
      {
          discordToWhatsApp,
          formatUsername,
          safeAsync,
          trimMessage
      } = require('./util.js'),
      Twinkle = require('../util/twinkle.js'),
      SIBaza = require('../util/si-db.js'),
      config = require('./config.json');

/**
 * Constants.
 */
const EVENTS = [
    'auth_failure',
    'authenticated',
    'change_battery',
    'change_state',
    'disconnected',
    'error',
    'group_join',
    'group_leave',
    'group_update',
    // 'media_uploaded',
    'message',
    'message_ack',
    // 'message_create',
    'message_revoke_everyone',
    // 'message_revoke_me',
    'qr',
    'ready'
];

/**
 * Main class.
 */
class WhatsAppDiscord {
    /**
     * Class constructor.
     */
    constructor() {
        if (config.si) {
            this.db = new SIBaza(config.si);
        }
        this.queue = new PQueue({
            concurrency: 1
        });
        this.initWebhooks();
        this.cache = new Cache();
        this.cache.on('error', this.cacheError.bind(this));
        this.initClient();
    }
    /**
     * Initializes Discord webhook clients for each group.
     */
    initWebhooks() {
        if (config.reporting) {
            this.reporting = new WebhookClient(config.reporting);
        }
        this.groups = config.groups.map(group => new Group(group));
        this.groups.forEach(g => this.createTwinkle(g));
    }
    /**
     * Creates a Twinkle IPC instance.
     * @param {Group} group Group for which to create a Twinkle instance
     */
    createTwinkle(group) {
        if (!group.socketPath) {
            return;
        }
        group.addTwinkle(
            new Twinkle(group.socketPath)
                .on('error', this.twinkleError.bind(this))
                .on('connected', this.twinkleConnected.bind(this))
                .on('disconnected', this.twinkleDisconnected.bind(this))
                .on('message', this.twinkleMessage.bind(this, group))
        );
    }
    /**
     * Handles Twinkle connection errors.
     * @param {Error} error Twinkle connection error that occurred
     */
    async twinkleError(error) {
        if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
            // We will already know a disconnection happened.
            return;
        }
        await this.report('Twinkle connection error:', error);
    }
    /**
     * Listens for Twinkle connections.
     */
    async twinkleConnected() {
        await this.report('Connected to Twinkle.');
    }
    /**
     * Listens for Twinkle disconnecting.
     */
    async twinkleDisconnected() {
        await this.report('Disconnected from Twinkle.');
    }
    /**
     * Handles Twinkle messages.
     * @param {object} group Group information
     * @param {object} message Twinkle message object
     */
    async twinkleMessage(group, {
        attachments, message, member, mentions, reference
    }) {
        if (
            Date.now() - message.createdTimestamp > 5000 ||
            message.channelId !== group.channelId ||
            !this.isReady ||
            message.webhookId
        ) {
            return;
        }
        const chat = await this.client.getChatById(group.id);
        const mentioned = [];
        const mentionMap = {};
        for (const userId of mentions.users) {
            const student = await this.db.getStudentByDiscordID(userId);
            if (!student) {
                continue;
            }
            for (const phoneNumber of student.phoneNumbers) {
                const contact = await this.client.getContactById(`${phoneNumber}@c.us`);
                if (contact) {
                    mentioned.push(contact);
                    if (!mentionMap[userId]) {
                        mentionMap[userId] = [];
                    }
                    mentionMap[userId].push(phoneNumber);
                }
            }
        }
        const content = discordToWhatsApp(
            message,
            member,
            attachments,
            mentionMap
        );
        let quotedMessageId = null;
        if (reference) {
            quotedMessageId = this.cache.getWhatsApp(reference.messageId);
        }
        const sentMessage = await chat.sendMessage(content, {
            mentions: mentioned,
            quotedMessageId
        });
        this.cache.add(sentMessage.id._serialized, message.id);
    }
    /**
     * Emitted when an error while saving cache occurs.
     * @param {Error} error The error that occurred
     */
    async cacheError(error) {
        await this.report('An error occurred while saving cache', error);
    }
    /**
     * Initializes the WhatsApp Web client.
     */
    initClient() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: `whatsapp-service-${hostname()}`,
                dataPath: 'session'
            })
        });
        for (const event of EVENTS) {
            this.client.on(event, this[
                event.replace(/_(\w)/g, (_, letter) => letter.toUpperCase())
            ].bind(this));
        }
    }
    /**
     * Emitted when there has been an error while trying to restore an
     * existing session.
     * @param {string} message Message received during the error
     */
    async authFailure(message) {
        await this.report(`AUTHENTICATION FAILURE: ${message}`);
        // Clear authentication data.
        await rename('session', `old-session-${Date.now()}`);
        // Restart client.
        await this.report('Destroying client...');
        this.isReady = false;
        await this.client.destroy();
        this.initClient();
        await this.run();
    }
    /**
     * Emitted when authentication is successful.
     */
    async authenticated() {
        await this.report('Authenticated to WhatsApp.');
    }
    /**
     * Emitted when the battery percentage for the attached device changes.
     * @param {object} batteryInfo See documentation
     */
    async changeBattery(batteryInfo) {
        if (batteryInfo.battery < 10 && !batteryInfo.plugged) {
            await this.report('Battery status is below 10%!');
        }
    }
    /**
     * Emitted when the connection state changes.
     * @param {WAState} state The new connection state
     */
    async changeState(state) {
        switch (state) {
            case 'CONFLICT':
                await this.report('Conflicting with another client!');
                break;
            case 'CONNECTED':
                await this.report('Reconnected.');
                break;
            case 'DEPRECATED_VERSION':
                await this.report(
                    'We\'re using a deprecated version of WhatsApp Web!'
                );
                break;
            case 'OPENING':
                await this.report('Reconnecting...');
                break;
            case 'PAIRING':
                await this.report('Pairing...');
                break;
            case 'PROXYBLOCK':
                await this.report('Our proxy has been blocked!');
                break;
            case 'SMB_TOS_BLOCK':
            case 'TOS_BLOCK':
                await this.report('WhatsApp has blocked us!');
                break;
            case 'TIMEOUT':
                await this.report('A timeout occurred.');
                break;
            case 'UNPAIRED':
                break;
            case 'UNLAUNCHED':
            case 'UNPAIRED_IDLE':
            default:
                await this.report(`Unknown state: ${state}`);
                break;
        }
    }
    /**
     * Emitted when the client has been disconnected.
     * @param {WAState} reason State that caused the disconnect
     */
    async disconnected(reason) {
        switch (reason) {
            case 'UNPAIRED':
                await this.report('Another device has paired.');
                break;
            case 'NAVIGATION':
                await this.report('Device disconnected from application.');
                break;
            default:
                await this.report(`DISCONNECTED: ${reason}`);
                break;
        }
    }
    /**
     * An error occurred. This event is emitted by every EventEmitter.
     * @param {Error} error The error that occurred
     */
    async error(error) {
        if (
            error &&
            typeof error.cause === 'string' &&
            error.cause.includes('Page crashed!')
        ) {
            await this.report('Page crashed! Attempting to restart...');
            await this.kill();
            // This should tell systemd to restart the service.
            process.exit(1);
        } else {
            await this.report('Unknown error:', error);
        }
    }
    /**
     * Emitted when a user joins the chat via invite link or is added by an
     * admin.
     * @param {GroupNotification} notification Notification about the action
     */
    groupJoin(notification) {
        console.info(
            new Date(notification.timestamp),
            notification.author,
            'added you to',
            notification.chatId
        );
    }
    /**
     * Emitted when a user leaves the chat or is removed by an admin.
     * @param {GroupNotification} notification Notification about the action
     */
    groupLeave(notification) {
        console.info(
            new Date(notification.timestamp),
            notification.author,
            'removed you from',
            notification.chatId
        );
    }
    /**
     * Emitted when group settings are updated, such as subject,
     * description or picture.
     * @param {GroupNotification} notification Notification about the action
     */
    groupUpdate(notification) {
        console.info(
            new Date(notification.timestamp),
            notification.author,
            'updated',
            notification.chatId,
            ':',
            notification.type
        );
    }
    /**
     * Emitted when a new message is received.
     * @param {Message} message The message that was received
     */
    message(message) {
        if (message.fromMe || this.killing) {
            return;
        }
        for (const group of this.groups) {
            if (group.id && message.from !== group.id) {
                continue;
            }
            this.queue.add(() => safeAsync(
                () => this.process(message, group),
                error => this.report('Error while relaying message', error)
            ));
            break;
        }
    }
    /**
     * Processes a WhatsApp message in a specific group.
     * @param {Message} message Message to process
     * @param {Group} group Group to which the message was sent
     */
    async process(message, group) {
        const contact = await message.getContact();
        let avatarURL = null;
        try {
            avatarURL = await contact.getProfilePicUrl();
        } catch (error) {
            // This is a common whatsapp-web.js error right now, just log it.
            console.error(new Date(), 'Error while obtaining profile picture.');
        }
        const {pushname, number} = contact;
        if (!number) {
            // What.
            await this.report('Contact does not have a number.');
            console.debug(contact);
            return;
        }
        const user = this.db ?
            await this.db.getStudentByPhone(number) :
            null;
        const options = {
            allowedMentions: {
                parse: ['users']
            },
            avatarURL,
            username: formatUsername(pushname, number, group.callNumber, user)
        };
        if (message.hasQuotedMsg) {
            await this.handleQuotedMessage(message, group, options);
        }
        if (message.hasMedia) {
            await this.handleMediaMessage(message, options);
        }
        if (message.hasMedia || message.body) {
            await this.relayMessage(message, group, options);
        }
        await (await message.getChat()).sendSeen();
    }
    /**
     * Sends an embed right before a message that quoted another message.
     * @param {Message} message The message that was received
     * @param {object} group WhatsApp group configuration
     * @param {object} options Discord webhook options
     */
    async handleQuotedMessage(message, group, options) {
        const quoted = await message.getQuotedMessage();
        const {number, pushname} = await quoted.getContact();
        const student = this.db ?
            await this.db.getStudentByPhone(number) :
            null;
        const description = await this.getQuotedMessageContents(quoted, group);
        const title = number === config.number ?
            'You' :
            formatUsername(pushname, number, group.callNumber, student);
        const msg = await group.send('', {
            ...options,
            embeds: [{
                description,
                title
            }]
        });
        this.cache.add(message.id._serialized, msg.id);
    }
    /**
     * Modifies Discord webhook options to add files that were sent along with
     * the WhatsApp message.
     * @param {Message} message The message that was received
     * @param {object} options Discord webhook options to be modified
     */
    async handleMediaMessage(message, options) {
        let media = null;
        for (let i = 0; i < 3; ++i) {
            try {
                media = await message.downloadMedia();
            } catch (error) {
                await this.report('Failed to download media:', error);
            }
        }
        if (!media) {
            return;
        }
        const buffer = Buffer.from(media.data, 'base64');
        const type = await FileType.fromBuffer(buffer);
        options.files = [{
            attachment: buffer,
            name: media.filename ?
                media.filename :
                type ?
                    `attachment.${type.ext}` :
                    'unknown'
        }];
    }
    /**
     * Final stage of relaying a WhatsApp message to Discord.
     * @param {Message} message WhatsApp message to relay
     * @param {object} group WhatsApp group configuration
     * @param {object} options Discord webhook options
     */
    async relayMessage(message, group, options) {
        let msg = null;
        try {
            msg = await group.send(
                await this.formatWhatsApp(message.body),
                options
            );
        } catch (error) {
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('Request entity too large')
            ) {
                try {
                    const title = options.files[0].name;
                    delete options.files;
                    options.embeds = [{
                        // eslint-disable-next-line max-len
                        description: 'The file exceeded Discord\'s file size limit. Please visit the WhatsApp group to view the file.',
                        title: `Attachment ${title} failed to send!`
                    }];
                    await group.send(message.body, options);
                } catch (anotherError) {
                    await this.report(
                        'Retried upload failed to send',
                        anotherError
                    );
                }
            } else {
                await this.report('Unknown Discord error', error);
            }
        }
        if (msg && msg.id) {
            this.cache.add(message.id._serialized, msg.id);
        }
    }
    /**
     * Emitted when an ack event occurrs on message type.
     * @param {Message} message The message that was affected
     * @param {MessageAck} ack The new ACK value
     */
    messageAck(message, ack) {
        console.info(
            new Date(),
            'Message',
            message.id._serialized,
            'in',
            message.from,
            ack === 1 ?
                'successfully sent' :
                ack === 2 ?
                    'successfully received' :
                    `had its ACK status changed to ${ack}`
        );
    }
    /**
     * Emitted when a message is deleted for everyone in the chat.
     * @param {Message} revokedMessage Message that was revoked
     * @param {Message} oldMessage Old message data (can be null)
     */
    messageRevokeEveryone(revokedMessage, oldMessage) {
        if (oldMessage) {
            console.info(
                new Date(),
                'Message',
                oldMessage.id._serialized,
                'in',
                oldMessage.from,
                'was deleted.'
            );
        } else {
            console.info(
                new Date(),
                'Message',
                revokedMessage.id._serialized,
                'in',
                revokedMessage.from,
                'was deleted.'
            );
        }
    }
    /**
     * Emitted when the QR code is received.
     * @param {string} qr QR code
     */
    qr(qr) {
        qrcode.generate(qr, {
            small: true
        }, image => this.report(`QR code received:\`\`\`\n${image}\`\`\``));
    }
    /**
     * Emitted when the client has initialized and is ready to receive
     * messages.
     */
    async ready() {
        await this.report('The client is ready!');
        this.isReady = true;
        if (config.ping) {
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
            }
            this.pingChat = await (await this.client
                .getContactById(config.ping.contact))
                .getChat();
            this.pingInterval = setInterval(
                this.ping.bind(this),
                config.ping.interval || 60 * 60 * 1000
            );
        }
    }
    /**
     * Initializes the relay.
     */
    async run() {
        await this.report('Initializing client...');
        this.client.initialize();
    }
    /**
     * Gets contents of the message quote embed for relaying to Discord.
     * @param {Message} quoted Quoted message
     * @param {object} group Group configuration
     * @returns {string} Contents of the message quote embed
     */
    async getQuotedMessageContents(quoted, group) {
        const message = quoted.body ?
                  await this.formatWhatsApp(quoted.body) :
                  quoted.type,
              messageId = this.cache.getDiscord(quoted.id._serialized),
              url = messageId ?
                  `**[View message](${group.messageURL(messageId)})**` :
                  '';
        return `${message}\n${url}`;
    }
    /**
     * Converts mentions from a WhatsApp message and applies formatting changes.
     * @param {string} content WhatsApp message contents
     * @returns {string} Formatted Discord message
     */
    async formatWhatsApp(content) {
        const students = {},
              mentions = content.match(/@(\d+)/g);
        if (this.db && mentions) {
            for (const match of mentions) {
                const number = match.substring(1);
                if (!students[number]) {
                    students[number] = await this.db.getStudentByPhone(number);
                }
            }
        }
        return trimMessage(content.replace(
            /@(\d+)/g,
            (full, match) => (students[match] ?
                `<@${students[match].discordID}>` :
                full)
        )
        .replace(/\*(.*?)\*/g, '**$1**')
        .replace(/~(.*?)~/g, '~~$1~~')
        .replace(/```([^\n`]+)```/g, '`$1`'));
    }
    /**
     * Ends the relay.
     */
    async kill() {
        await this.report('Killing client...');
        this.killing = true;
        try {
            this.isReady = false;
            await this.client.destroy();
        } catch (error) {
            console.error('An error occurred while killing the client:', error);
        }
        for (const group of this.groups) {
            group.destroy();
        }
        if (this.reporting) {
            this.reporting.destroy();
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.cache.destroy();
    }
    /**
     * Reports a message to Discord if configured.
     * @param {string} message Message to report
     * @param {Error} error Optional error that occurred
     */
    async report(message, error) {
        console.error(new Date(), message, error);
        if (this.reporting) {
            let newMessage = message;
            if (error) {
                newMessage += `\`\`\`${error.stack.slice(0, 1000)}\`\`\``;
            }
            if (newMessage.length === 0) {
                newMessage = '<empty message>';
            }
            await this.reporting.send({
                content: newMessage
            });
        }
    }
    /**
     * Pings a configured WhatsApp chat.
     */
    async ping() {
        try {
            await this.pingChat.sendMessage('Ping');
        } catch (error) {
            await this.report('Ping error:', error);
        }
    }
    /**
     * Writes all active chats to a file.
     */
    async dumpChats() {
        try {
            const chats = await this.client.getChats();
            await writeFile(
                'monitoring.txt',
                `Active chats:\n${chats.map(chat => `- ${chat.name}`).join('\n')}`
            );
        } catch (error) {
            await this.report('Failed to dump chats:', error);
        }
    }
}

module.exports = WhatsAppDiscord;
