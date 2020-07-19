/**
 * index.js
 *
 * To be imported by all other fetchers in etfnews.
 */
'use strict';

/**
 * Base fetcher class for all etfnews fetchers.
 *
 * A fetcher in etfnews is a component that communicates with news sources
 * and fetches latest available content from them which is then compared
 * against old content and formatted in a format.
 */
class Fetcher {
    /**
     * Class constructor.
     * @param {any} config Fetcher configuration
     */
    constructor(config) {
        // This currently doesn't do anything.
    }
    /**
     * Fetches content from news sources.
     *
     * Must be implemented by all fetchers.
     * @param {URL} url URL from which to fetch latest content
     * @returns {any} Latest available content on the specified location
     */
    async fetch(url) {
        throw new Error('Not implemented.');
    }
    /**
     * Cleans up the fetcher's resources so the agent can cleanly exit.
     */
    async kill() {
        // This currently doesn't do anything.
    }
}

module.exports = Fetcher;
