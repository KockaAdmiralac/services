/**
 * index.js
 *
 * To be imported by all other transports in etfnews.
 */
/**
 * Base transport class for all etfnews transports.
 *
 * A transport in etfnews is a component that consumes formatted content
 * and relays it to other services where etfnews users can easily review
 * the changes made to relevant web pages.
 */
export default class Transport {
    /**
     * Class constructor.
     * @param {any} config Transport configuration
     */
    constructor(config) {
        // This currently doesn't do anything.
    }
    /**
     * Transports formatted content to other services.
     *
     * This method must be implemented by all transports.
     * @param {any} formattedContent Content that went through an etfnews
     *                               formatter to be transported.
     */
    async transport(formattedContent) {
        throw new Error('Not implemented.')
    }
    /**
     * Cleans up the transport's resources so that the agent can cleanly exit.
     */
    async kill() {
        // This currently doesn't do anything.
    }
}
