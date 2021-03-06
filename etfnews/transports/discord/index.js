/**
 * index.js
 *
 * This module is imported when `discord` is used as a transport's type in
 * etfnews configuration.
 */
'use strict';

/**
 * Importing modules.
 */
const Transport = require('..'),
      {WebhookClient} = require('discord.js');

/**
 * Transports formatted content to Discord.
 * @augments Transport
 */
class DiscordTransport extends Transport {
    /**
     * Class constructor.
     * Initializes a Discord webhook.
     * @param {object} config Discord webhook configuration
     */
    constructor(config) {
        super(config);
        this._webhook = new WebhookClient(config.id, config.token);
    }
    /**
     * Transports formatted content to Discord.
     * @param {object} formattedContent Content that went through an etfnews
     *                               formatter to be transported.
     */
    async transport(formattedContent) {
        await this._webhook.send(formattedContent.content, formattedContent.options);
    }
    /**
     * Cleans up the transport's resources, in this case, the Discord webhook,
     * so the agent can cleanly exit.
     */
    async kill() {
        super.kill();
        this._webhook.destroy();
    }
}

module.exports = DiscordTransport;
