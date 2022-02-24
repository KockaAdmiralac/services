/**
 * index.js
 *
 * This module is imported when `etf` is used as a fetcher's type in
 * etfnews configuration.
 */
import Fetcher from '../index.js';
import pkg from '../../package.json' assert {type: 'json'};
import ETFClient from '../../../etf-proxy/client.js';

/**
 * Constants.
 */
const NEWS_HTML_FILTER = /\$\('#vesti-arhiva-filtered'\)\.html\("(.*)"\);\n\$\('#vesti-arhiva-pagination'\)\.html\("/;
const INFORMATION_FILTER = /<h3 class="vest-naslov"><a href="\/([^"]+)">([^<]*)<\/a><\/h3><time class="vest-objavljeno" datetime="([^"]+)" title="[^"]*">[^<]*<\/time><\/header><div class="vest-ukratko"><p>([^<]*)<\/p>/;

/**
 * Fetches news from ETF main page.
 * @augments Fetcher
 */
export default class ETFFetcher extends Fetcher {
    /**
     * Class constructor. Initializes the HTTP client.
     * @param {object} config Fetcher configuration
     */
    constructor(config) {
        super(config);
        this._client = new ETFClient({
            headers: {
                'Accept': 'text/javascript',
                'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.description}`,
                'X-Requested-With': 'XMLHttpRequest'
            },
            resolveBodyOnly: true
        });
        this.cache = new Date();
    }
    /**
     * Fetches content from the specified web page.
     * @param {URL} url URL from which to fetch latest content
     * @returns {string} Latest available content on the specified location
     */
    async fetch(url) {
        try {
            const t = Date.now();
            const pad = num => String(num).padStart(2, 0);
            const d = this.cache;
            const searchParams = {
                ...this.queryParams(url),
                t,
                'q[objavljeno_od]': `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
            };
            const response = (await this._client.get(url, {searchParams}))
                .match(NEWS_HTML_FILTER)[1]
                .replace(/\\\//g, '/')
                .replace(/\\"/g, '"')
                .replace(/\\n+\s*/g, ' ')
                .trim();
            if (response === '') {
                return '';
            }
            this.cache = new Date();
            const parsed = INFORMATION_FILTER.exec(response);
            if (parsed === null) {
                console.error('Failed to parse news!', response);
                return '';
            }
            const snippet = parsed[4].trim();
            return JSON.stringify({
                date: new Date(parsed[3]),
                snippet: snippet ? snippet : 'No description provided.',
                title: parsed[2],
                url: `https://etf.bg.ac.rs/${parsed[1]}`
            });
        } catch (error) {
            // TODO: Add handling of specific request errors here.
            throw error;
        }
    }
}
