/**
 * etfnews.js
 *
 * This is where magic happens, if your definition of magic includes a lot of
 * Node.js module loading.
 */
import Page from './page.js';

/**
 * Agent for etfnews.
 *
 * Loads all configured transports, formats and fetchers and initializes
 * all pages.
 */
export default class ETFNews {
    /**
     * Class constructor.
     * @param {object} config ETFNews configuration 
     */
    constructor(config) {
        this.config = config;
    }
    /**
     * Initializes all submodules and pages of etfnews.
     */
    async init() {
        const {transports, formats, fetchers, pages} = this.config;
        await this._initSubmodule('transport', transports);
        await this._initSubmodule('format', formats);
        await this._initSubmodule('fetcher', fetchers);
        this._initPages(pages);
    }
    /**
     * Initializes transports, formats or fetchers used in ETFNews.
     *
     * All submodules in etfnews are consistently named and placed under paths
     * in the format of {submodule type}s/{submodule name}/index.js.
     * (For example: transports/discord/index.js)
     * @param {string} type Type of the submodule to be initialized. One of
     *                      'transport', 'format' or 'fetcher'.
     * @param {object} submodules Configuration for all submodules
     */
    async _initSubmodule(type, submodules) {
        this[`_${type}s`] = {};
        for (const name in submodules) {
            const config = submodules[name];
            let Submodule;
            if (typeof config !== 'object') {
                console.warn(`'${name}' ${type} has invalid configuration.`);
                continue;
            }
            try {
                Submodule = (await import(`../${type}s/${config.type}/index.js`)).default;
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
     * Configures all pages with previously initialized submodules.
     * @param {object} pages Configuration for all pages
     */
    _initPages(pages) {
        this._pages = {};
        for (const name in pages) {
            const config = pages[name];
            if (!config.fetcher || !config.transport || !config.format) {
                console.warn(`Page '${name} does not have a configured fetcher, transport or format.`);
            }
            const transport = this._transports[config.transport];
            const format = this._formats[config.format];
            const fetcher = this._fetchers[config.fetcher];
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
     * Cleans up resources used by all submodules and pages and cleanly exits
     * the agent.
     */
    async kill() {
        for (const content of ['page', 'transport', 'format', 'fetcher']) {
            for (const name in this[`_${content}s`]) {
                await this[`_${content}s`][name].kill();
            }
        }
    }
}
