/**
 * index.js
 *
 * Base transport.
 */
'use strict';

/**
 * Base transport.
 */
class Transport {
    /**
     * Class constructor.
     */
    constructor(config) {
        // Stub.
    }
    /**
     * Transports formatted content.
     */
    async transport(formattedContent) {
        throw new Error('Not implemented.')
    }
    /**
     * Kills the transport.
     */
    async kill() {
        // Stub.
    }
}

module.exports = Transport;
