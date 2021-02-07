/**
 * index.js
 *
 * This module is imported when `basic` is used as a fetcher's type in
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
 * Basic fetcher that fetches content on a specified URL via HTTP.
 * @augments Fetcher
 */
class BasicFetcher extends Fetcher {
    /**
     * Class constructor. Initializes the HTTP client.
     * @param {object} config Fetcher configuration
     */
    constructor(config) {
        super(config);
        this._replacements = config.replacements instanceof Array ?
            config.replacements.map(([r1, r2]) => [new RegExp(r1, 'g'), r2]) :
            [];
        this._client = got.extend({
            headers: {
                'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.description} [${pkg.url}]`
            },
            method: 'GET',
            resolveBodyOnly: true,
            retry: 0
        });
    }
    /**
     * Fetches content from the specified web page.
     * @param {URL} url URL from which to fetch latest content
     * @returns {string} Latest available content on the specified location
     */
    async fetch(url) {
        try {
            const t = Date.now(),
                  searchParams = new URLSearchParams(url.searchParams);
            searchParams.set('t', t);
            const response = await this._client(url, {searchParams});
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

module.exports = BasicFetcher;
