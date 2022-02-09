import got from 'got';
import config from './config.json' assert {type: 'json'};

const BODY_OPTIONS = new Set([
    'json',
    'form',
    'method',
    'searchParams'
]);

export default class ETFClient {
    constructor(options) {
        if (options && options.prefixUrl && !config.disable) {
            this.prefix = options.prefixUrl;
            delete options.prefixUrl;
        } else {
            this.prefix = '';
        }
        this.client = got.extend(options);
    }
    async request(url, options) {
        if (config.disable) {
            return this.client(url, options);
        }
        const gotOptions = {};
        const bodyOptions = {};
        const headers = {};
        for (const option in options) {
            if (option === 'headers') {
                Object.assign(headers, options[option]);
            } else if (BODY_OPTIONS.has(option)) {
                bodyOptions[option] = options[option];
            } else {
                gotOptions[option] = options[option];
            }
        }
        // Overwrites the Authorization header!
        headers['Authorization'] = `Bearer ${config.token}`;
        const response = await this.client.post(config.url, {
            headers,
            json: {
                options: bodyOptions,
                url: `${this.prefix}${url}`
            },
            ...gotOptions,
            // Weird behavior of resolveBodyOnly!
            resolveBodyOnly: false
        }).json();
        return response.body;
    }
    get(url, options) {
        return this.request(url, {
            method: 'GET',
            ...options
        })
    }
    post(url, options) {
        return this.request(url, {
            method: 'POST',
            ...options
        })
    }
}
