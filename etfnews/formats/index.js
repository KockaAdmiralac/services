/**
 * index.js
 *
 * To be imported by all other formats in etfnews.
 */
/**
 * Base format class for all etfnews formats.
 *
 * A format in etfnews is a component that acts as a bridge between fetchers
 * and transports - it formats the content produced (and fetched) by one or
 * more fetchers so it can be read (and transported) by one or more transports.
 */
export default class Format {
    /**
     * Class constructor.
     * @param {any} config Format configuration
     */
    constructor(config) {
        // This currently doesn't do anything.
    }
    /**
     * Formats the differences between fetched content into objects that
     * transports can read and transport.
     *
     * Must be implemented by all formats.
     * @param {URL} url URL of the page where the content was fetched from
     * @param {string} title Title of the page
     * @param {any} newContent Newly fetched content
     * @param {any} oldContent Previously fetched content
     * @returns {any} Transport-compatible objects
     */
    async format(url, title, newContent, oldContent) {
        throw new Error('Not implemented.');
    }
    /**
     * Cleans up the format's resources so the agent can cleanly exit.
     */
    async kill() {
        // This currently doesn't do anything.
    }
}
