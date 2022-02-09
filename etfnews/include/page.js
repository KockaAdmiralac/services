/**
 * page.js
 *
 * Handles a single page's process of fetching, formatting and relaying.
 */
import {readdir, readFile, mkdir, writeFile} from 'fs/promises';
import {URL} from 'url';

/**
 * Constants.
 */
const DEFAULT_REFRESH_INTERVAL = 30000;

/**
 * Represents a single page whose changes are checked for.
 *
 * Handles communication between a fetcher, a format and a transport and
 * persists old page content between fetches.
 */
export default class Page {
    /**
     * Class constructor. Handles page configuration.
     * Errors occurring here should be handled by the client.
     * @param {string} name The configured name of the page for debugging
     * @param {object} config The page's configuration
     * @param {Transport} transport The page's transport
     * @param {Format} format The page's format
     * @param {Fetcher} fetcher The page's fetcher
     */
    constructor(name, config, transport, format, fetcher) {
        this._name = name;
        this._url = new URL(config.url);
        this._title = config.title;
        this._transport = transport;
        this._format = format;
        this._fetcher = fetcher;
        this._oldContent = null;
        this._interval = setInterval(
            this._interval.bind(this),
            config.interval || DEFAULT_REFRESH_INTERVAL
        );
    }
    /**
     * Rechecks the page for changed content and relays that content.
     */
    async _interval() {
        let content = null;
        let formattedContent = null;
        try {
            content = await this._fetcher.fetch(this._url);
        } catch (error) {
            console.error(`Failed to fetch content for '${this._name}':`, error);
            return;
        }
        if (!this._oldContent) {
            // We're running for the first time, restore old content.
            this._oldContent = await this._restoreOldContent();
        }
        if (this._oldContent) {
            try {
                formattedContent = await this._format.format(this._url, this._title, content, this._oldContent);
            } catch (error) {
                console.error(`Failed to format content for '${this._name}':`, error);
                return;
            }
        }
        if (formattedContent) {
            try {
                await this._transport.transport(formattedContent);
            } catch (error) {
                console.error(`Failed to transport content for '${this._name}':`, error);
                return;
            }
        }
        if (formattedContent || typeof this._oldContent !== 'string') {
            this._oldContent = content;
            try {
                await this._recordNewContent();
            } catch (error) {
                console.error(`Failed to record old content for '${this._name}':`, error);
            }
        } else {
            this._oldContent = content;
        }
    }
    /**
     * Restores old page content from history to make up for the service's
     * downtime.
     *
     * This needs to handle all errors raised by itself.
     * @returns {string|null} Old page content from history
     */
    async _restoreOldContent() {
        try {
            const historyFiles = (await readdir(`hist/${this._name}`)).sort();
            if (historyFiles.length) {
                return await readFile(`hist/${this._name}/${historyFiles[historyFiles.length - 1]}`, {
                    encoding: 'utf-8'
                });
            } else {
                return null;
            }
        } catch (error) {
            if (!error || error.code !== 'ENOENT') {
                console.error(`Failed to restore old content for ${this._name}:`, error);
            }
            return null;
        }
    }
    /**
     * Records new page content to history.
     */
    async _recordNewContent() {
        await mkdir(`hist/${this._name}`, {
            recursive: true
        });
        await writeFile(`hist/${this._name}/${Date.now()}.html`, this._oldContent, {
            encoding: 'utf-8'
        });
    }
    /**
     * Stops refreshing the page so the service can cleanly exit.
     */
    async kill() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }
}
