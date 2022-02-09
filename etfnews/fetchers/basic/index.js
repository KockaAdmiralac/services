/**
 * index.js
 *
 * This module is imported when `basic` is used as a fetcher's type in
 * etfnews configuration.
 */
import Fetcher from '../index.js';
import pkg from '../../package.json' assert {type: 'json'};
import ETFClient from '../../../etf-proxy/client.js';

/**
 * Basic fetcher that fetches content on a specified URL via HTTP.
 * @augments Fetcher
 */
export default class BasicFetcher extends Fetcher {
    /**
     * Class constructor. Initializes the HTTP client.
     * @param {object} config Fetcher configuration
     */
    constructor(config) {
        super(config);
        this._replacements = config.replacements instanceof Array ?
            config.replacements.map(([r1, r2]) => [new RegExp(r1, 'g'), r2]) :
            [];
        this._client = new ETFClient({
            headers: {
                'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.description} [${pkg.url}]`
            },
            resolveBodyOnly: true
        });
    }
    /**
     * Fetches content from the specified web page.
     * @param {URL} url URL from which to fetch latest content
     * @returns {string} Latest available content on the specified location
     */
    async fetch(url) {
        try {
            const t = Date.now();
            const searchParams = {
                ...this.queryParams(url),
                t
            };
            const response = await this._client.get(url, {searchParams});
            let replacedContent = response.replace(new RegExp(t, 'g'), '');
            for (const replacement of this._replacements) {
                replacedContent = replacedContent.replace(...replacement);
            }
            return replacedContent;
        } catch (error) {
            // TODO: Add handling of specific request errors here.
            throw error;
        }
    }
}
