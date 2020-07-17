/**
 * index.js
 *
 * Basic content fetcher from ETF servers.
 */
'use strict';

/**
 * Importing modules.
 */
const Fetcher = require('..'),
      pkg = require('../../package.json'),
      got = require('got');

/**
 * Basic content fetcher from ETF servers.
 */
class BasicFetcher extends Fetcher {
    /**
     * Class constructor.
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
     * Fetches page content.
     */
    async fetch(url) {
        try {
            const t = Date.now(),
                  response = await this._client(url, {
                searchParams: {
                    t,
                    ...url.searchParams
                }
            });
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
