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
        this.queue = [];
        this.currentlyProcessing = false;
        this.initWebhooks();
        this.initCache();
        this.initClient();
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
        }
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
     * @param {string} message ?
     */
    async authFailure(message) {
        console.error(new Date(), 'AUTHENTICATION FAILURE:', message);
        console.info('Clearing authentication data and retrying...');
        // Clear authentication data and restart client.
        delete this.cache._session;
        await this.client.destroy();
        this.initClient();
    }
    /**
     * Emitted when authentication is successful.
     * @param {object} session Object containing session information.
     */
    authenticated(session) {
        console.info(new Date(), 'Authenticated to WhatsApp.');
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
        await this.report('Unknown error:', error);
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
        if (message.fromMe) {
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
        // Unlock the resources.
        this.currentlyProcessing = false;
        if (this.queue.length) {
            // Process next message in queue.
            await this.message(this.queue.shift());
        }
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
            msg = await group.webhook.send(message.body, options);
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
            'had its ACK status changed to',
            ack
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
        console.info(new Date(), 'QR code received.');
        qrcode.generate(qr, {
            small: true
        });
    }
    /**
     * Emitted when the client has initialized and is ready to receive
     * messages.
     */
    ready() {
        console.info(new Date(), 'The client is ready!');
    }
    /**
     * Initializes the relay.
     */
    run() {
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
     * Gets contents of the message quote embed.
     * @param {Message} quoted Quoted message
     * @param {object} group Group configuration
     * @returns {string} Contents of the message quote embed
     */
    getQuotedMessageContents(quoted, group) {
        const message = quoted.body ? quoted.body : quoted.type,
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
        console.info('Closing...');
        await this.client.destroy();
        for (const group of config.groups) {
            group.webhook.destroy();
        }
        if (this.reporting) {
            this.reporting.destroy();
        }
        clearInterval(this.cacheInterval);
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
                newMessage += `:\`\`\`${error.stack}\`\`\``;
            }
            await this.reporting.send(newMessage);
        }
    }
}

module.exports = WhatsAppDiscord;
