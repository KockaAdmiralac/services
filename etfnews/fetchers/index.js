/**
 * index.js
 *
 * Base class for all fetchers.
 */
'use strict';

/**
 * Base class for all fetchers.
 */
class Fetcher {
    /**
     * Class constructor.
     */
    constructor(config) {
        // Stub.
    }
    /**
     * Fetches page content.
     */
    async fetch(url) {
        throw new Error('Not implemented.');
    }
    /**
     * Kills the fetcher.
     */
    async kill() {
        // Stub.
    }
}

module.exports = Fetcher;
