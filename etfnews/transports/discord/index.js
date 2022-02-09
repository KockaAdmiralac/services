/**
 * index.js
 *
 * This module is imported when `discord` is used as a transport's type in
 * etfnews configuration.
 */
import Transport from '../index.js';
import {WebhookClient} from 'discord.js';

/**
 * Transports formatted content to Discord.
 * @augments Transport
 */
export default class DiscordTransport extends Transport {
    /**
     * Class constructor.
     * Initializes a Discord webhook.
     * @param {object} config Discord webhook configuration
     */
    constructor(config) {
        super(config);
        this._webhook = new WebhookClient(config);
    }
    /**
     * Transports formatted content to Discord.
     * @param {object} formattedContent Content that went through an etfnews
     *                               formatter to be transported.
     */
    async transport(formattedContent) {
        const options = formattedContent.options;
        if (formattedContent.content) {
            options.content = formattedContent.content;
        }
        await this._webhook.send(options);
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
