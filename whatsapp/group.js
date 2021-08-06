/**
 * group.js
 *
 * Data structure for a WhatsApp group.
 */
'use strict';

/**
 * Importing modules.
 */
const {WebhookClient} = require('discord.js');

/**
 * WhatsApp group configuration handler.
 */
class Group {
    /**
     * Class constructor.
     * @param {object} config Group configuration
     */
    constructor(config) {
        this.id = config.groupId;
        this.callNumber = config.callNumber;
        this.channelId = config.channelId;
        this.guildId = config.guildId;
        this.socketPath = config.socket;
        this.webhook = new WebhookClient({
            id: config.webhookId,
            token: config.webhookToken
        });
    }
    /**
     * Adds a Twinkle instance to the group.
     * @param {TwinkleIPC} twinkle Twinkle instance to add
     */
    addTwinkle(twinkle) {
        this.twinkle = twinkle;
    }
    /**
     * Gets a Discord message URL from a message ID.
     * @param {string} messageId Discord message ID
     * @returns {string} Discord message URL
     */
    messageURL(messageId) {
        return `https://discord.com/channels/${this.guildId}/${this.channelId}/${messageId}`;
    }
    /**
     * Sends a message through the group's webhook.
     * @param {string} content Content to send
     * @param {object} options Message options
     * @returns {Message} Discord message object
     */
    send(content, options) {
        const sendOptions = {...options};
        if (content) {
            sendOptions.content = content;
        }
        return this.webhook.send(sendOptions);
    }
    /**
     * Deallocates resources used by a group so the process can cleanly exit.
     */
    destroy() {
        this.webhook.destroy();
        if (this.twinkle) {
            this.twinkle.disconnect();
        }
    }
}

module.exports = Group;
