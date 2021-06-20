/**
 * index.js
 *
 * This module is imported when `moodle` is used as a fetcher's type in
 * etfnews configuration.
 */
'use strict';

/**
 * Importing modules.
 */
const Fetcher = require('..'),
      pkg = require('../../package.json'),
      got = require('got'),
      {parse} = require('node-html-parser'),
      {CookieJar} = require('tough-cookie');

/**
 * Fetches content of a Moodle course.
 * @augments Fetcher
 */
class MoodleFetcher extends Fetcher {
    /**
     * Class constructor. Initializes the HTTP client.
     * @param {object} config Fetcher configuration
     */
    constructor(config) {
        super(config);
        this._url = config.url;
        this._username = config.username;
        this._password = config.password;
        this._client = got.extend({
            cookieJar: new CookieJar(),
            headers: {
                'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.description} [${pkg.url}]`
            },
            method: 'GET',
            resolveBodyOnly: true,
            retry: 0
        });
    }
    /**
     * Logs in to Moodle.
     */
    async login() {
        console.info(new Date(), 'Logging in to Moodle...');
        const loginHTML = await this._client(`${this._url}/login/index.php`),
              tree = parse(loginHTML),
              logintoken = tree.querySelector('.loginsub [name="logintoken"]')
                        .getAttribute('value');
        return this._client(`${this._url}/login/index.php`, {
            form: {
                logintoken,
                password: this._password,
                rememberusername: 1,
                username: this._username
            },
            method: 'POST'
        });
    }
    /**
     * Fetches content from the specified web page.
     * @param {URL} url URL from which to fetch latest content
     * @param {bool} retried Whether the request was already retried
     * @returns {string} Latest available content on the specified location
     */
    async fetch(url, retried) {
        try {
            const t = Date.now(),
                  searchParams = new URLSearchParams(url.searchParams);
            searchParams.set('t', t);
            const response = (await this._client(url, {searchParams}))
                .replace(new RegExp(t, 'g'), ''),
                tree = parse(response, {
                    blockTextElements: {
                        script: false
                    }
                });
            if (tree.querySelector('.usermenu .login')) {
                if (retried) {
                    throw new Error('Login to Moodle unsuccessful!');
                } else {
                    const resetLogin = !this._loginPromise;
                    if (resetLogin) {
                        this._loginPromise = this.login();
                    }
                    await this._loginPromise;
                    if (resetLogin) {
                        delete this._loginPromise;
                    }
                    console.info(new Date(), 'Login procedure finished executing.');
                    return this.fetch(url, true);
                }
            }
            return tree.querySelector('.course-content').outerHTML;
        } catch (error) {
            // TODO: Add handling of specific request errors here.
            throw error;
        }
    }
}

module.exports = MoodleFetcher;
