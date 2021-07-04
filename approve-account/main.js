#!/usr/bin/env node
'use strict';

/**
 * Importing modules.
 */
const {WebhookClient} = require('discord.js'),
      got = require('got'),
      mysql = require('mysql2/promise'),
      {CookieJar} = require('tough-cookie'),
      {db, discord, interval, mediawiki, suffix} = require('./config.json');

/**
 * Constants.
 */
const http = got.extend({
    cookieJar: new CookieJar(),
    headers: {
        'User-Agent': 'approve-account'
    },
    prefixUrl: `${mediawiki.url}${mediawiki.script || ''}/`,
    resolveBodyOnly: true,
    retry: 0
}), serviceNotification = new WebhookClient(discord.id, discord.token),
databasePool = mysql.createPool({
    connectionLimit: 10,
    database: db.database,
    host: db.host || 'localhost',
    user: db.username,
    password: db.password,
    queueLimit: 0,
    waitForConnections: true
}), QUERY = 'SELECT `acr_email`, `acr_id`, `acr_name`, `acr_real_name` FROM `account_requests` ' +
            'WHERE `acr_email_authenticated` IS NOT NULL AND ' +
            '`acr_deleted` = 0 AND ' +
            '`acr_email` LIKE ? AND ' +
            'NOT EXISTS (SELECT `user_id` FROM `user` WHERE `acr_email` = `user_email`)';

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
        await serviceNotification.send(text.slice(0, 2000));
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
    let createaccount = '', csrf = '', login = '';
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
            loginreturnurl: mediawiki.url,
            logintoken: token,
            username: mediawiki.username,
            password: mediawiki.password
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
    console.debug('Registration HTML:', await http.post('index.php', {
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
    }));
}

/**
 * Runs on a specified amount of time, checking for new account requests and
 * approving them if they match the configured domain.
 */
async function doInterval() {
    try {
        const requests = (await databasePool.execute(QUERY, [
            `%@${suffix}`
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
    await notify('Closing service...');
    if (intervalId) {
        clearInterval(intervalId);
    }
    await databasePool.end();
    serviceNotification.destroy();
}

intervalId = setInterval(doInterval, interval);
process.on('SIGINT', kill);
process.on('SIGTERM', kill);
