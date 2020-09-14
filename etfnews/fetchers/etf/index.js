/**
 * index.js
 *
 * This module is imported when `etf` is used as a fetcher's type in
 * etfnews configuration.
 */
'use strict';

/**
 * Importing modules.
 */
const Fetcher = require('..'),
      pkg = require('../../package.json'),
      got = require('got');

/**
 * Constants.
 */
const NEWS_HTML_FILTER = /\$\('#vesti-arhiva-filtered'\)\.html\("(.*)"\);\n\$\('#vesti-arhiva-pagination'\)\.html\("/,
      INFORMATION_FILTER = /<h3 class="vest-naslov"><a href="\/([^"]+)">([^<]+)<\/a><\/h3><time class="vest-objavljeno" datetime="([^"]+)" title="[^"]+">[^<]+<\/time><\/header><div class="vest-ukratko"><p>([^<]+)<\/p>/;

/**
 * Fetches news from ETF main page.
 * @augments Fetcher
 */
class ETFFetcher extends Fetcher {
    /**
     * Class constructor. Initializes the HTTP client.
     * @param {object} config Fetcher configuration
     */
    constructor(config) {
        super(config);
        this._client = got.extend({
            headers: {
                'Accept': 'text/javascript',
                'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.description}`,
                'X-Requested-With': 'XMLHttpRequest'
            },
            method: 'GET',
            resolveBodyOnly: true,
            retry: 0
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
            const t = Date.now(),
                  searchParams = new URLSearchParams(url.searchParams),
                  d = this.cache,
                  pad = num => String(num).padStart(2, 0);
            searchParams.set('t', t);
            searchParams.set(
                'q[objavljeno_od]',
                `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
            );
            const response = (await this._client(url, {searchParams}))
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
            return JSON.stringify({
                date: new Date(parsed[3]),
                snippet: parsed[4],
                title: parsed[2],
                url: `https://etf.bg.ac.rs/${parsed[1]}`
            });
        } catch (error) {
            // TODO: Add handling of specific request errors here.
            throw error;
        }
    }
}

module.exports = ETFFetcher;
