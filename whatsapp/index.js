/**
 * main.js
 *
 * Main script of the relay.
 */
'use strict';

/**
 * Importing modules.
 */
const fs = require('fs'),
      {WebhookClient} = require('discord.js'),
      FileType = require('file-type'),
      {Client} = require('whatsapp-web.js'),
      qrcode = require('qrcode-terminal'),
      Twinkle = require('../util/twinkle.js'),
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
        this.initQueue();
        this.initWebhooks();
        this.initCache();
        this.initClient();
    }
    /**
     * Initializes message queuing.
     * @todo Move the queue to a separate class
     */
    initQueue() {
        this.queue = [];
        this.currentlyProcessing = false;
        this.lastMessageInQueue = null;
        this.queueCheckInterval = setInterval(
            this.queueCheck.bind(this),
            60000
        );
    }
    /**
     * Initializes Discord webhook clients for each group.
     */
    initWebhooks() {
        if (config.reporting) {
            this.reporting = new WebhookClient(
                config.reporting.id,
                config.reporting.token
            );
        }
        for (const group of config.groups) {
            group.webhook = new WebhookClient(
                group.webhookId,
                group.webhookToken
            );
            if (group.socket && group.groupId) {
                group.twinkle = new Twinkle(group.socket)
                    .on('error', this.twinkleError.bind(this))
                    .on('connected', this.twinkleConnected.bind(this))
                    .on('disconnected', this.twinkleDisconnected.bind(this))
                    .on('message', this.twinkleMessage.bind(this, group));
            }
        }
    }
    /**
     * Handles Twinkle connection errors.
     * @param {Error} error Twinkle connection error that occurred
     */
    async twinkleError(error) {
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
    async twinkleMessage(group, {message, member}) {
        if (
            Date.now() - message.createdTimestamp > 5000 ||
            message.channelID !== group.channelId ||
            !this.isReady ||
            message.webhookID
        ) {
            return;
        }
        const chat = await this.client.getChatById(group.groupId);
        await chat.sendMessage(`Poruka sa Discord-a od ${member.displayName}:\n${message.content}`);
    }
    /**
     * Initializes message cache.
     */
    initCache() {
        try {
            this.cache = require('./cache.json');
        } catch (error) {
            this.cache = {};
        }
        this.cacheInterval = setInterval(this.saveCache.bind(this), 5000);
    }
    /**
     * Initializes the WhatsApp Web client.
     */
    initClient() {
        this.client = new Client({
            session: this.cache && this.cache._session
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
        delete this.cache._session;
        await this.saveCache();
        // Restart client.
        await this.report('Destroying client...');
        this.isReady = false;
        await this.client.destroy();
        this.initClient();
        await this.run();
    }
    /**
     * Emitted when authentication is successful.
     * @param {object} session Object containing session information.
     */
    async authenticated(session) {
        await this.report('Authenticated to WhatsApp.');
        this.cache._session = session;
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
    async message(message) {
        if (message.fromMe || this.killing) {
            return;
        }
        if (this.currentlyProcessing) {
            // The queue is not empty, wait.
            console.debug('Current queue length:', this.queue.length);
            this.queue.push(message);
            return;
        }
        // Lock the resources.
        this.currentlyProcessing = true;
        for (const group of config.groups) {
            if (group.groupId && message.from !== group.groupId) {
                continue;
            }
            try {
                const contact = await message.getContact(),
                      options = {
                        allowedMentions: {
                            parse: ['roles', 'users']
                        },
                        avatarURL: await contact.getProfilePicUrl(),
                        username: this.formatUsername(
                            contact.pushname,
                            contact.number,
                            group.callNumber
                        )
                    };
                await this.handleQuotedMessage(message, group, options);
                await this.handleMediaMessage(message, options);
                if (message.hasMedia || message.body) {
                    await this.relayMessage(message, group, options);
                }
                await (await message.getChat()).sendSeen();
            } catch (error) {
                await this.report('Unknown error when relaying message', error);
            }
            break;
        }
        await this.popQueue();
    }
    /**
     * Sends an embed right before a message that quoted another message.
     * @param {Message} message The message that was received
     * @param {object} group WhatsApp group configuration
     * @param {object} options Discord webhook options
     */
    async handleQuotedMessage(message, group, options) {
        if (!message.hasQuotedMsg) {
            return;
        }
        const quoted = await message.getQuotedMessage(),
              quotedContact = await quoted.getContact();
        await group.webhook.send('', {
            ...options,
            embeds: [{
                description: this.getQuotedMessageContents(
                    quoted,
                    group
                ),
                title: this.formatUsername(
                    quotedContact.pushname,
                    quotedContact.number,
                    group.callNumber
                )
            }]
        });
    }
    /**
     * Modifies Discord webhook options to add files that were sent along with
     * the WhatsApp message.
     * @param {Message} message The message that was received
     * @param {object} options Discord webhook options to be modified
     */
    async handleMediaMessage(message, options) {
        if (!message.hasMedia) {
            return;
        }
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
        const buffer = Buffer.from(media.data, 'base64'),
              type = await FileType.fromBuffer(buffer);
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
        if (!message.hasMedia && !message.body) {
            return;
        }
        let msg = null;
        try {
            msg = await group.webhook.send(
                this.trimMessage(message.body),
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
                    await group.webhook.send(message.body, options);
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
            this.cache[message.id.id] = msg.id;
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
            message.id.id,
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
                oldMessage.id.id,
                'in',
                oldMessage.from,
                'was deleted.'
            );
        } else {
            console.info(
                new Date(),
                'Message',
                revokedMessage.id.id,
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
     * Formats a valid Discord webhook username so that it doesn't exceed 32
     * characters.
     * @param {string} name User's name
     * @param {string} number User's phone number
     * @param {string} callNumber Default call number
     * @returns {string} Discord webhook username of valid length
     */
    formatUsername(name, number, callNumber) {
        const normalizedNumber = callNumber && number.startsWith(callNumber) ?
            `0${number.slice(callNumber.length)}` :
            `+${number}`;
        if (!name) {
            if (normalizedNumber.length > 32) {
                return `${normalizedNumber.slice(0, 31)}…`;
            }
            return normalizedNumber;
        }
        if (name.length > 32) {
            return `${name.slice(0, 31)}…`;
        } else if (name.length + 5 > 32) {
            // Minimum: Name Surname (0*)
            return name;
        } else if (name.length + normalizedNumber.length + 3 > 32) {
            const length = 32 - name.length - 4;
            return `${name} (${normalizedNumber.slice(0, length)}…)`;
        }
        return `${name} (${normalizedNumber})`;
    }
    /**
     * Trims a message to fit into the Discord message size limit (2000).
     *
     * The message is trimmed to 1901 characters as message quoting may add
     * a link to the bottom of the quote embed (embed size limit is 2048).
     * @param {string} message Message to trim
     * @returns {string} Trimmed message
     */
    trimMessage(message) {
        if (message.length < 1900) {
            return message;
        }
        return `${message.slice(0, 1900)}…`;
    }
    /**
     * Gets contents of the message quote embed for relaying to Discord.
     * @param {Message} quoted Quoted message
     * @param {object} group Group configuration
     * @returns {string} Contents of the message quote embed
     */
    getQuotedMessageContents(quoted, group) {
        const message = quoted.body ?
                  this.trimMessage(quoted.body) :
                  quoted.type,
              url = this.cache[quoted.id.id] ?
                  `**[View message](https://discord.com/channels/${group.guildId}/${group.channelId}/${this.cache[quoted.id.id]})**` :
                  '';
        return `${message}\n${url}`;
    }
    /**
     * Saves the cache.
     */
    async saveCache() {
        try {
            await fs.promises.writeFile(
                'cache.json',
                JSON.stringify(this.cache)
            );
        } catch (error) {
            await this.report('An error occurred while saving cache:', error);
        }
    }
    /**
     * Ends the relay.
     */
    async kill() {
        await this.report('Killing client...');
        this.killing = true;
        this.queue = [];
        try {
            this.isReady = false;
            await this.client.destroy();
        } catch (error) {
            console.error('An error occurred while killing the client:', error);
        }
        for (const group of config.groups) {
            group.webhook.destroy();
            if (group.twinkle) {
                group.twinkle.disconnect();
            }
        }
        if (this.reporting) {
            this.reporting.destroy();
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        clearInterval(this.cacheInterval);
        clearInterval(this.queueCheckInterval);
    }
    /**
     * Unlocks the resources and processes the next message in queue.
     */
    async popQueue() {
        this.currentlyProcessing = false;
        if (this.queue.length) {
            await this.message(this.queue.shift());
        }
    }
    /**
     * Forwards the queue if it has been stuck on the last message.
     */
    async queueCheck() {
        if (this.queue.length === 0) {
            this.lastMessageInQueue = null;
            return;
        }
        if (this.lastMessageInQueue === this.queue[0]) {
            await this.report('Forwarding queue...');
            await this.popQueue();
        }
        this.lastMessageInQueue = this.queue[0];
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
            await this.reporting.send(newMessage);
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
}

module.exports = WhatsAppDiscord;
