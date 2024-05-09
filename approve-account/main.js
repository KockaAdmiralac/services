#!/usr/bin/env node --experimental-json-modules
import {WebhookClient} from 'discord.js';
import got from 'got';
import mysql from 'mysql2/promise';
import {CookieJar} from 'tough-cookie';
import config from './config.json' assert {type: 'json'};

/**
 * Constants.
 */
const http = got.extend({
    cookieJar: new CookieJar(),
    headers: {
        'User-Agent': 'approve-account'
    },
    prefixUrl: `${config.mediawiki.url}${config.mediawiki.script || ''}/`,
    resolveBodyOnly: true
});
const serviceNotification = new WebhookClient(config.discord);
const databasePool = mysql.createPool({
    connectionLimit: 10,
    database: config.db.database,
    host: config.db.host || 'localhost',
    user: config.db.username,
    password: config.db.password,
    queueLimit: 0,
    waitForConnections: true
});
const QUERY = 'SELECT `acr_email`, `acr_id`, `acr_name`, `acr_real_name` FROM `account_requests` ' +
    'WHERE `acr_email_authenticated` IS NOT NULL AND ' +
    '`acr_deleted` = 0 AND ' +
    '`acr_email` LIKE ? AND ' +
    'NOT EXISTS (SELECT `acd_user_id` FROM `account_credentials` WHERE `acr_email` = `acd_email`)';

/**
 * Global variables.
 */
let intervalId = null;

/**
 * Logs to console and relays a message to Discord.
 * @param {string} text Text to log and relay
 * @param {Error} error Error to log to console
 */
async function notify(text, error) {
    console.info(new Date(), text, error);
    if (serviceNotification && text.length) {
        await serviceNotification.send({
            content: text.slice(0, 2000)
        });
    }
}

/**
 * Gets CSRF and login tokens from MediaWiki.
 * @returns {[string, string]} Account creation, CSRF and login tokens
 */
async function getTokens() {
    const response = await http.get('api.php', {
        searchParams: {
            action: 'query',
            format: 'json',
            meta: 'tokens',
            type: 'createaccount|csrf|login'
        },
        responseType: 'json'
    });
    let createaccount = '';
    let csrf = '';
    let login = '';
    if (response && response.query && response.query.tokens) {
        const {
            createaccounttoken,
            csrftoken,
            logintoken
        } = response.query.tokens;
        if (csrftoken && csrftoken !== '+\\') {
            csrf = csrftoken;
        }
        if (logintoken && logintoken !== '+\\') {
            login = logintoken;
        }
        if (createaccounttoken && createaccounttoken !== '+\\') {
            createaccount = createaccounttoken;
        }
    }
    return [createaccount, csrf, login];
}

/**
 * Logs in to MediaWiki.
 * @param {string} token Login token
 */
async function login(token) {
    const response = await http.post('api.php', {
        form: {
            action: 'clientlogin',
            format: 'json',
            loginreturnurl: config.mediawiki.url,
            logintoken: token,
            username: config.mediawiki.username,
            password: config.mediawiki.password
        },
        responseType: 'json'
    });
    if (!response || !response.clientlogin || response.clientlogin.status !== 'PASS') {
        throw new Error(`Login failed: ${JSON.stringify(response)}`);
    }
}

/**
 * Approves an account request.
 * @param {object} request Database information about the request
 * @param {string} createAccountToken Account creation token
 * @param {string} csrfToken CSRF token
 */
async function approveRequest(request, createAccountToken, csrfToken) {
    await notify(`Approving request ${request.acr_id} from ${request.acr_name}`);
    await http.post('index.php', {
        form: {
            AccountRequestId: request.acr_id,
            authAction: 'create',
            force: '',
            title: 'Special:CreateAccount',
            wpCreateaccountMail: 1,
            wpCreateaccountToken: createAccountToken,
            wpEditToken: csrfToken,
            wpEmail: request.acr_email,
            wpName: request.acr_name,
            wpRealName: request.acr_real_name,
            wpReason: 'Automatically accepting user with known email suffix.'
        }
    });
}

/**
 * Runs on a specified amount of time, checking for new account requests and
 * approving them if they match the configured domain.
 */
async function doInterval() {
    try {
        const requests = (await databasePool.execute(QUERY, [
            `%@${config.suffix}`
        ]))[0];
        if (requests.length === 0) {
            return;
        }
        await notify('Requests are present.');
        let createAccountToken, csrfToken, loginToken;
        [createAccountToken, csrfToken, loginToken] = await getTokens();
        if (!csrfToken) {
            await notify('Logging in...');
            await login(loginToken);
            [createAccountToken, csrfToken, loginToken] = await getTokens();
        }
        await Promise.all(
            requests.map(r => approveRequest(r, createAccountToken, csrfToken))
        );
    } catch (error) {
        await notify('An error occurred during the interval', error);
    }
}

/**
 * Cleans up the resources and ends the process.
 */
async function kill() {
    await notify('Stopping service...');
    if (intervalId) {
        clearInterval(intervalId);
    }
    await databasePool.end();
    serviceNotification.destroy();
}

intervalId = setInterval(doInterval, config.interval);
process.on('SIGINT', kill);
process.on('SIGTERM', kill);
await notify('Service started.');
