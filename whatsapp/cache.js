/**
 * cache.js
 *
 * Handles all caching-related logic.
 */
'use strict';

/**
 * Importing modules.
 */
const {EventEmitter} = require('events'),
      fs = require('fs').promises;

/**
 * Caches Discord <-> WhatsApp message ID mapping, as well as old credentials
 * for WhatsApp Web.
 */
class Cache extends EventEmitter {
    /**
     * Class constructor.
     */
    constructor() {
        super();
        try {
            const cache = require('./cache.json');
            this.credentials = cache._session;
            delete cache._session;
            Object.freeze(this.credentials);
            const entries = Object.entries(cache);
            this.whatsAppToDiscord = new Map(entries);
            this.discordToWhatsApp = new Map(entries.map(e => e.reverse()));
        } catch (error) {
            if (error.code !== 'MODULE_NOT_FOUND') {
                this.emit('error', error);
            }
            this.whatsAppToDiscord = new Map();
            this.discordToWhatsApp = new Map();
            this.credentials = null;
        }
        this.interval = setInterval(this.save.bind(this), 5000);
        this.changed = false;
    }
    /**
     * Gets WhatsApp Web credentials of the current user.
     */
    get session() {
        return this.credentials;
    }
    /**
     * Sets WhatsApp Web credentials of the current user.
     * @param {object} session WhatsApp Web session information.
     */
    set session(session) {
        this.changed = session !== this.credentials;
        this.credentials = session;
        Object.freeze(this.credentials);
    }
    /**
     * Connects a WhatsApp message to a Discord message.
     * @param {string} whatsAppId WhatsApp message ID
     * @param {string} discordId Discord message ID
     */
    add(whatsAppId, discordId) {
        this.whatsAppToDiscord.set(whatsAppId, discordId);
        this.discordToWhatsApp.set(discordId, whatsAppId);
        this.changed = true;
    }
    /**
     * Gets a Discord message ID from a WhatsApp message ID.
     * @param {string} whatsAppId WhatsApp message ID
     * @returns {string} Discord message ID
     */
    getDiscord(whatsAppId) {
        return this.whatsAppToDiscord.get(whatsAppId);
    }
    /**
     * Gets a WhatsApp message ID from a Discord message ID.
     * @param {string} discordId Discord message ID
     * @returns {string} WhatsApp message ID
     */
    getWhatsApp(discordId) {
        return this.discordToWhatsApp.get(discordId);
    }
    /**
     * Saves the cache to a file if it changed.
     */
    async save() {
        if (!this.changed) {
            return;
        }
        try {
            const cache = Object.fromEntries(this.whatsAppToDiscord);
            cache._session = this.credentials;
            await fs.writeFile('cache.json', JSON.stringify(cache));
            this.changed = false;
        } catch (error) {
            this.emit('error', error);
        }
    }
    /**
     * Deallocates resources used by the cache (cache saving interval) so the
     * process can cleanly exit.
     */
    destroy() {
        clearInterval(this.interval);
    }
}

module.exports = Cache;
