/**
 * main.js
 *
 * Main module for the Twitch service.
 */
'use strict';

/**
 * Importing modules
 */
const express = require('express'),
      parser = require('body-parser'),
      https = require('https'),
      got = require('got'),
      fsPromises = require('fs').promises,
      config = require('./config.json'),
      pkg = require('./package.json');

/**
 * Service class.
 */
class GoPirateSoftware {
    /**
     * Class constructor.
     */
    constructor() {
        this._initConfig();
        this._initServer();
        this._online = null;
        this._client = got.extend({
            headers: {
                'Client-ID': this._config.client,
                //'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.repository.url}`
            },
            method: 'GET',
            prefixUrl: 'https://api.twitch.tv',
            resolveBodyOnly: true,
            responseType: 'json'
        });
        process.on('SIGINT', this._kill.bind(this));
    }
    /**
     * Initializes the configuration.
     */
    _initConfig() {
        try {
            this._config = require('./config.json');
        } catch (error) {
            console.error(
                'An error occurred while loading the configuration:',
                error
            );
            process.exit(1);
        }
    }
    /**
     * Initializes the web server.
     */
    _initServer() {
        this._app = express();
        this._app.use(parser.json());
        this._app.use(parser.urlencoded({
            extended: true
        }));
        this._app.get('/', this._request.bind(this));
    }
    /**
     * Run the web server.
     */
    async run() {
        this._check();
        this._interval = setInterval(this._check.bind(this), config.interval);
        const c = this._config;
        if (c.cert && c.key) {
            try {
                this._server = https.createServer({
                    cert: await fsPromises.readFile(c.cert, 'utf-8'),
                    key: await fsPromises.readFile(c.key, 'utf-8')
                }, this._app).listen(c.port, this._serverCallback.bind(this));
            } catch (error) {
                console.error('Failed to run the HTTPS server!', error);
                process.exit();
            }
        } else {
            this._server = this._app.listen(
                c.port,
                this._serverCallback.bind(this)
            );
        }
    }
    /**
     * Return stream online information.
     * @param {express.Request} request HTTP request interface
     * @param {express.Response} response HTTP response interface
     */
    _request(request, response) {
        response.header('Access-Control-Allow-Origin', '*')
                .header(
                    'Access-Control-Allow-Headers',
                    'Origin, X-Requested-With, Content-Type, Accept'
                )
                .json(this._online);
    }
    /**
     * Checks whether the stream is online.
     */
    async _check() {
        try {
            const data = await this._client('helix/streams', {
                searchParams: {
                    cb: Date.now(),
                    user_login: this._config.user
                }
            });
            if (
                typeof data === 'object' &&
                data.data instanceof Array &&
                typeof data.data[0] === 'object' &&
                data.data[0].type === 'live'
            ) {
                this._online = data.data[0];
            } else {
                this._online = null;
            }
        } catch (error) {
            if (error && error.response && error.response.statusCode) {
                if (error.response.statusCode === 503) {
                    console.error(new Date(), 'Twitch API server error.');
                } else {
                    console.error(new Date(), 'Unknown request error:', error);
                }
            } else {
                console.error(new Date(), 'Unknown error:', error);
            }
        }
    }
    /**
     * Callback after the web server runs.
     */
    _serverCallback() {
        console.info('The web server is running!');
        this._initialized = true;
    }
    /**
     * Cleans up the resources on SIGINT.
     */
    _kill() {
        console.info('Web server shutting down...');
        if (this._initialized) {
            this._initialized = false;
            this._server.close();
        }
        if (this._interval) {
            clearInterval(this._interval);
            delete this._interval;
        }
    }
}

module.exports = new GoPirateSoftware();
module.exports.run();
