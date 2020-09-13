#!/usr/bin/env node --tls-min-v1.0 --tls-cipher-list="AES128-SHA"
/**
 * main.js
 *
 * Main auto-signup script.
 */
'use strict';

/**
 * Importing modules.
 */
const fs = require('fs'),
      {WebhookClient} = require('discord.js'),
      got = require('got'),
      {parse} = require('node-html-parser'),
      {CookieJar} = require('tough-cookie'),
      {etf, interval, relays, notifications} = require('./config.json');

/**
 * Globals.
 */
const http = got.extend({
    cookieJar: new CookieJar(),
    headers: {
        'User-Agent': 'ETF auto-lab client'
    },
    method: 'GET',
    prefixUrl: 'https://rti.etf.bg.ac.rs/',
    resolveBodyOnly: true,
    retry: 0
}), serviceWebhook = notifications ? new WebhookClient(notifications.id, notifications.token) : null,
    typeNameMap = {
        domaci: 'homework',
        labvezbe: 'lab'
    },
    relayList = relays.map(config => ({
        autoSignup: config.autoSignup,
        regex: new RegExp(config.regex, 'u'),
        type: config.type,
        webhook: new WebhookClient(config.id, config.token)
    }));
let cache = null;

/**
 * Refreshes the lab service list.
 */
async function getServices() {
    const html = await http('labvezbe/'),
          tree = parse(html);
    return tree.querySelectorAll('ol.rounded-list li a')
        .map(node => ({
            name: node.rawText.trim(),
            type: 'labvezbe'
        }));
}

/**
 * Refreshes the homework list.
 */
async function getHomeworks() {
    const html = await http('domaci'),
          tree = parse(html);
    return tree.querySelectorAll('a')
        .map(node => ({
            name: node.rawText.trim(),
            type: 'domaci'
        }));
}

/**
 * Logs into the site.
 */
async function login() {
    const response = await http.post('labvezbe/loz.php', {
        form: {
            sifra: etf.password,
            username: etf.username
        }
    });
    if (response.includes('Morate dati ispravne login podatke!')) {
        throw new Error('Invalid credentials.');
    }
}

/**
 * Retrieves available lab terms.
 * @param {string} service Service to check for availability
 */
async function getTerms(service) {
    const html = await http('labvezbe', {
        searchParams: {
            servis: service
        }
    }), tree = parse(html);
    return tree.querySelectorAll('a')
        // Get all links on page
        .map(node => node.getAttribute('href'))
        // Filter out signup links
        .filter(href => href && href.startsWith('addUserToTermin.php'))
        // Get term ID from URL
        .map(href => /&terminID=(\d+)$/.exec(href.trim()))
        // Filter out successful regex matches
        .filter(Boolean)
        // Get the term ID as number
        .map(match => Number(match[1]))
        // Sort term IDs just in case
        .sort((a, b) => a - b)
        // Return the first one
        [0];
}

/**
 * Automatically signs up to a lab term.
 * @param {string} service Lab service name
 * @param {number} term Term ID to sign up for
 */
async function signup(service, term) {
    const response = await http('labvezbe/addUserToTermin.php', {
        searchParams: {
            servis: service,
            terminID: term
        }
    });
    if (response.includes('Nije uspe')) {
        throw new Error('Unsuccessful lab signup.');
    }
}

/**
 * Saves the service cache.
 */
async function saveCache() {
    await fs.promises.writeFile('cache.json', JSON.stringify(Array.from(cache)));
}

/**
 * Logs to console and relays a message to Discord.
 * @param {string} text Text to log and relay
 * @param {Error} error Error to log to console
 */
async function notify(text, error) {
    console.info(new Date(), text, error);
    if (serviceWebhook && text.length) {
        await serviceWebhook.send(text);
    }
}

/**
 * Records a lab as viewed in cache and attempts auto-signup if needed.
 * @param {string} name Lab service name
 */
async function recordLab({name, type}) {
    try {
        const key = `${type}:${name}`,
              typeName = typeNameMap[type];
        await notify(`Recording ${typeName}: ${name}.`);
        cache.add(key);
        await saveCache();
        for (const relay of relayList) {
            if (!relay.regex.exec(name) || relay.type !== type) {
                continue;
            }
            await relay.webhook.send(`New ${typeName}: [${name.replace(/_/g, ' ')}](<https://rti.etf.bg.ac.rs/${type}/?servis=${encodeURIComponent(name)}>)`);
            if (!relay.autoSignup) {
                continue;
            }
            await notify('Attempting automatic signup...');
            await login();
            await notify('Getting available terms...');
            const availableTerm = await getTerms(name);
            if (typeof availableTerm === 'number') {
                await notify(`Available term: ${availableTerm}, signing up...`);
                await signup(name, availableTerm);
                await notify('Signup successful!');
            } else {
                await notify('No available terms to sign up for!');
            }
        }
    } catch (error) {
        await notify('An error occurred while recording lab!', error);
    }
}

/**
 * Refreshes the lab list.
 */
async function refresh() {
    try {
        await Promise.all(
            (await getServices())
                .concat(await getHomeworks())
                .filter(({name, type}) => !cache.has(`${type}:${name}`))
                .map(recordLab)
        );
    } catch (error) {
        if (error.name === 'RequestError') {
            if (error.code === 'ETIMEDOUT') {
                console.error(
                    new Date(),
                    'Timed out while refreshing services list'
                );
            } else {
                await notify('Unknown request error.', error);
            }
        } else {
            await notify(
                'An error occurred while refreshing service list.',
                error
            );
        }
    }
}

/**
 * Entry point.
 */
async function main() {
    try {
        cache = new Set(JSON.parse(await fs.promises.readFile('cache.json', {
            encoding: 'utf-8'
        })));
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            console.info('Cache not found, initializing anew.');
            cache = new Set(
                (await getServices())
                    .concat(await getHomeworks())
                    .map(({type, name}) => `${type}:${name}`)
            );
            await saveCache();
        } else {
            console.error('Error while loading cache:', error);
        }
    }
    await refresh();
    setInterval(refresh, interval);
    await notify('Service started.');
}

main();
