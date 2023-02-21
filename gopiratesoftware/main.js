#!/usr/bin/env node
'use strict';

import express from 'express';
import {readFile} from 'fs/promises';
import got from 'got';
import {dirname} from 'path';
import {fileURLToPath} from 'url';

// Global state
let online = null;
let initialized = false;
let interval;
let timeout;
let server;
let client;
let config;
let token;

async function readJSON(name) {
    try {
        return JSON.parse(await readFile(`${dirname(fileURLToPath(import.meta.url))}/${name}`, {
            encoding: 'utf-8'
        }));
    } catch (error) {
        return null;
    }
}

async function refreshToken() {
    try {
        const {access_token, expires_in} = await client.post('https://id.twitch.tv/oauth2/token', {
            searchParams: {
                client_id: config.client,
                client_secret: config.secret,
                grant_type: 'client_credentials'
            }
        });
        token = access_token;
        let expiration = expires_in * 1000;
        if (expiration >= 2**31) {
            expiration = 2**31 - 1;
        }
        timeout = setTimeout(refreshToken, expiration);    
    } catch (error) {
        // We need to catch errors here since this is run in a `setTimeout`.
        console.error('Error while refreshing token:', error);
    }
}

async function check() {
    try {
        const data = await client.get('https://api.twitch.tv/helix/streams', {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            searchParams: {
                cb: Date.now(),
                user_login: config.user
            }
        });
        if (
            typeof data === 'object' &&
            data.data instanceof Array &&
            typeof data.data[0] === 'object' &&
            data.data[0].type === 'live'
        ) {
            online = data.data[0];
        } else {
            online = null;
        }
    } catch (error) {
        if (error && error.response && error.response.statusCode) {
            if (error.response.statusCode === 503) {
                console.error(new Date(), 'Twitch API server error.');
            } else {
                console.error(new Date(), 'Unknown request error:', error.response.body);
            }
        } else {
            console.error(new Date(), 'Unknown error:', error);
        }
    }
}

function request(req, res) {
    res
        .header('Access-Control-Allow-Origin', '*')
        .header(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept'
        )
        .json(online);
}

function kill() {
    console.info('Web server shutting down...');
    if (initialized) {
        initialized = false;
        server.close();
    }
    if (interval) {
        clearInterval(interval);
    }
    if (timeout) {
        clearTimeout(timeout);
    }
}

async function main() {
    config = await readJSON('config.json');
    const pkg = await readJSON('package.json');
    client = got.extend({
        headers: {
            'Client-ID': config.client,
            'User-Agent': `${pkg.name} v${pkg.version}: ${pkg.repository.url}`
        },
        method: 'GET',
        resolveBodyOnly: true,
        responseType: 'json'
    });
    await refreshToken();
    await check();
    interval = setInterval(check, config.interval);
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({
        extended: true
    }));
    app.get('/', request);
    server = app.listen(config.port, function() {
        console.info('Server is running.');
        initialized = true;
    });
    process.on('SIGINT', kill);
}

main();
