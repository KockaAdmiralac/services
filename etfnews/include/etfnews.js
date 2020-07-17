/**
 * etfnews.js
 *
 * Client for ETFNews.
 */
'use strict';

/**
 * Importing modules.
 */
const Page = require('./page.js');

/**
 * Client for ETFNews.
 */
class ETFNews {
    /**
     * Class constructor.
     */
    constructor(config) {
        this._initSubmodule('transport', config.transports);
        this._initSubmodule('format', config.formats);
        this._initSubmodule('fetcher', config.fetchers);
        this._initPages(config.pages);
    }
    /**
     * Initializes transports, formats or fetchers used in ETFNews.
     */
    _initSubmodule(type, submodules) {
        this[`_${type}s`] = {};
        for (const name in submodules) {
            const config = submodules[name];
            let Submodule;
            if (typeof config !== 'object') {
                console.warn(`'${name}' ${type} has invalid configuration.`);
                continue;
            }
            try {
                Submodule = require(`../${type}s/${config.type}`);
            } catch (error) {
                console.warn(`'${name}' ${type} failed to load:`, error);
                continue;
            }
            try {
                this[`_${type}s`][name] = new Submodule(config);
            } catch (error) {
                console.warn(`A configuration error occurred in ${type} '${name}':`, error);
            }
        }
    }
    /**
     * Initializes page configuration.
     */
    _initPages(pages) {
        this._pages = {};
        for (const name in pages) {
            const config = pages[name];
            if (!config.fetcher || !config.transport || !config.format) {
                console.warn(`Page '${name} does not have a configured fetcher, transport or format.`);
            }
            const transport = this._transports[config.transport],
                  format = this._formats[config.format],
                  fetcher = this._fetchers[config.fetcher];
            if (!transport) {
                console.warn(`Page '${name}' uses an uninitialized transport.`);
                continue;
            }
            if (!format) {
                console.warn(`Page '${name}' uses an uninitialized format.`);
                continue;
            }
            if (!fetcher) {
                console.warn(`Page '${name}' uses an uninitialized fetcher.`);
                continue;
            }
            try {
                this._pages[name] = new Page(name, config, transport, format, fetcher);
            } catch (error) {
                console.warn(`Page '${name}' failed to configure:`, error);
            }
        }
    }
    /**
     * Kills the ETFNews client.
     */
    async kill() {
        for (const content of ['page', 'transport', 'format', 'fetcher']) {
            for (const name in this[`_${content}s`]) {
                await this[`_${content}s`][name].kill();
            }
        }
    }
}

module.exports = ETFNews;
