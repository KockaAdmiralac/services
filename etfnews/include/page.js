/**
 * page.js
 *
 * Handles a single page's process of fetching, formatting and relaying.
 */
'use strict';

/**
 * Importing modules.
 */
const {URL} = require('url');

/**
 * Constants.
 */
const DEFAULT_REFRESH_INTERVAL = 30000;

/**
 * Handles a single page's process of fetching, formatting and relaying.
 */
class Page {
    /**
     * Class constructor. Handles page configuration.
     * Errors occurring here should be handled by the client.
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
     * Refreshes the page.
     */
    async _interval() {
        let content, formattedContent;
        try {
            content = await this._fetcher.fetch(this._url);
        } catch (error) {
            console.error(`Failed to fetch content for '${this._name}':`, error);
            return;
        }
        if (!this._oldContent) {
            this._oldContent = content;
            return;
        }
        try {
            formattedContent = await this._format.format(this._url, this._title, content, this._oldContent);
        } catch (error) {
            console.error(`Failed to format content for '${this._name}':`, error);
            return;
        }
        if (!formattedContent) {
            return;
        }
        try {
            await this._transport.transport(formattedContent);
        } catch (error) {
            console.error(`Failed to transport content for '${this._name}':`, error);
        }
        this._oldContent = content;
    }
    /**
     * Kills the page.
     */
    async kill() {
        if (this._interval) {
            clearInterval(this._interval);
        }
    }
}

module.exports = Page;
