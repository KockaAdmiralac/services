/**
 * index.js
 *
 * Base format.
 */

/**
 * Base format.
 */
class Format {
    /**
     * Class constructor.
     */
    constructor(config) {
        // Stub.
    }
    /**
     * Formats fetched content into embeds for transporting.
     */
    async format(url, title, newContent, oldContent) {
        throw new Error('Not implemented.');
    }
    /**
     * Kills the format.
     */
    async kill() {
        // Stub.
    }
}

module.exports = Format;
