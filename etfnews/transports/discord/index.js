/**
 * index.js
 *
 * Discord transport.
 */
'use strict';

/**
 * Importing modules.
 */
const Transport = require('..'),
      {WebhookClient, Webhook} = require('discord.js');

/**
 * Discord transport.
 */
class DiscordTransport extends Transport {
    /**
     * Class constructor.
     */
    constructor(config) {
        super(config);
        this._webhook = new WebhookClient(config.id, config.token);
    }
    /**
     * Transports formatted content to Discord.
     */
    async transport(formattedContent) {
        await this._webhook.send(formattedContent.content, formattedContent.options);
    }
    /**
     * Kills the transport.
     */
    async kill() {
        this._webhook.destroy();
    }
}

module.exports = DiscordTransport;
