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
        this.initWebhooks();
        this.initCache();
        this.initClient();
    }
    /**
     * Initializes Discord webhook clients for each group.
     */
    initWebhooks() {
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
        this.client = new Client();
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
    authFailure(message) {
        console.error(new Date(), 'AUTHENTICATION FAILURE:', message);
    }
    /**
     * Emitted when authentication is successful.
     * @param {object} session Object containing session information.
     */
    authenticated(session) {
        console.info(new Date(), 'Authenticated to WhatsApp:', session);
    }
    /**
     * Emitted when the battery percentage for the attached device changes.
     * @param {object} batteryInfo See documentation
     */
    changeBattery(batteryInfo) {
        console.info(new Date(), 'Battery percentage changed:', batteryInfo);
    }
    /**
     * Emitted when the connection state changes.
     * @param {WAState} state The new connection state
     */
    changeState(state) {
        switch (state) {
            case 'CONFLICT':
                console.error(
                    new Date(),
                    'Conflicting with another client!'
                );
                break;
            case 'CONNECTED':
                console.info(new Date(), 'Reconnected.');
                break;
            case 'DEPRECATED_VERSION':
                console.error(
                    new Date(),
                    'We\'re using a deprecated version of WhatsApp Web!'
                );
                break;
            case 'OPENING':
                console.info(new Date(), 'Reconnecting...');
                break;
            case 'PAIRING':
                console.info(new Date(), 'Pairing...');
                break;
            case 'PROXYBLOCK':
                console.error(new Date(), 'Our proxy has been blocked!');
                break;
            case 'SMB_TOS_BLOCK':
            case 'TOS_BLOCK':
                console.error(new Date(), 'WhatsApp has blocked us!');
                break;
            case 'TIMEOUT':
                console.error(new Date(), 'A timeout occurred.');
                break;
            case 'UNPAIRED':
                break;
            case 'UNLAUNCHED':
            case 'UNPAIRED_IDLE':
            default:
                console.error(new Date(), 'Unknown state:', state);
                break;
        }
    }
    /**
     * Emitted when the client has been disconnected.
     * @param {WAState} reason State that caused the disconnect
     */
    disconnected(reason) {
        switch (reason) {
            case 'UNPAIRED':
                console.error(new Date(), 'Another device has paired.');
                break;
            default:
                console.error(new Date(), 'DISCONNECTED:', reason);
                break;
        }
    }
    /**
     * An error occurred. This event is emitted by every EventEmitter.
     * @param {Error} error The error that occurred
     */
    error(error) {
        console.info(new Date(), 'Unknown error:', error);
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
        for (const group of config.groups) {
            if (group.groupId && message.from !== group.groupId) {
                continue;
            }
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
            if (message.hasQuotedMsg) {
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
            if (message.hasMedia) {
                const media = await message.downloadMedia(),
                    buffer = Buffer.from(media.data, 'base64'),
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
            if (message.hasMedia || message.body) {
                const msg = await group.webhook.send(message.body, options);
                if (msg.id) {
                    this.cache[message.id.id] = msg.id;
                }
            }
            await (await message.getChat()).sendSeen();
            break;
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
            console.error('An error occurred while saving cache:', error);
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
        clearInterval(this.cacheInterval);
    }
}

module.exports = WhatsAppDiscord;
