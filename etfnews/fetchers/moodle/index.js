/**
 * index.js
 *
 * This module is imported when `moodle` is used as a fetcher's type in
 * etfnews configuration.
 */
import Fetcher from '../index.js';
import pkg from '../../package.json' assert {type: 'json'};
import {parse} from 'node-html-parser';
import {CookieJar} from 'tough-cookie';
import ETFClient from '../../../etf-proxy/client.js';

/**
 * Fetches content of a Moodle course.
 * @augments Fetcher
 */
export default class MoodleFetcher extends Fetcher {
    /**
     * Class constructor. Initializes the HTTP client.
     * @param {object} config Fetcher configuration
     */
    constructor(config) {
        super(config);
        this._url = config.url;
        this._username = config.username;
        this._password = config.password;
        this._client = new ETFClient({
            cookieJar: new CookieJar(),
            headers: {
                'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.description} [${pkg.url}]`
            },
            resolveBodyOnly: true
        });
    }
    /**
     * Logs in to Moodle.
     */
    async login() {
        console.info(new Date(), 'Logging in to Moodle...');
        const loginHTML = await this._client.get(`${this._url}/login/index.php`);
        const tree = parse(loginHTML);
        const logintoken = tree
            .querySelector('.loginsub [name="logintoken"]')
            .getAttribute('value');
        return this._client.post(`${this._url}/login/index.php`, {
            form: {
                logintoken,
                password: this._password,
                rememberusername: 1,
                username: this._username
            }
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
            const t = Date.now();
            const searchParams = {
                ...this.queryParams(url),
                t
            };
            const response = (await this._client.get(url, {searchParams}))
                .replace(new RegExp(t, 'g'), '');
            const tree = parse(response, {
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
            return tree.querySelector('.course-content, .generalbox').outerHTML;
        } catch (error) {
            // TODO: Add handling of specific request errors here.
            throw error;
        }
    }
}
