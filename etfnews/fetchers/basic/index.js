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
        this._client = got.extend({
            headers: {
                'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.description}`
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
            return response
                .replace(new RegExp(t, 'g'), '')
                .replace(/<!--(.*?)-->/gs, '')
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .join('\n');
        } catch (error) {
            // TODO: Add handling of specific request errors here.
            throw error;
        }
    }
}

module.exports = BasicFetcher;
