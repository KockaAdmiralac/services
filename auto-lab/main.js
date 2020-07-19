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
      {autoSignupRegex, discord, etf, interval} = require('./config.json');

/**
 * Globals.
 */
const http = got.extend({
    cookieJar: new CookieJar(),
    headers: {
        'User-Agent': 'ETF auto-lab client'
    },
    method: 'GET',
    prefixUrl: 'https://rti.etf.bg.ac.rs/labvezbe',
    resolveBodyOnly: true,
    retry: 0
}), regex = autoSignupRegex ? new RegExp(autoSignupRegex, 'u') : null,
    webhook = discord ? new WebhookClient(discord.id, discord.token) : null;
let cache = null;

/**
 * Refreshes the lab service list.
 */
async function getServices() {
    const html = await http('/'),
          tree = parse(html);
    return tree.querySelectorAll('ol.rounded-list li a')
        .map(node => node.rawText.trim());
}

/**
 * Logs into the site.
 */
async function login() {
    const response = await http.post('/loz.php', {
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
    const html = await http('/', {
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
    const response = await http('/addUserToTermin.php', {
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
 * Records a lab as viewed in cache and attempts auto-signup if needed.
 * @param {string} name Lab service name
 */
async function recordLab(name) {
    try {
        console.info(new Date(), 'Recording lab', name);
        cache.add(name);
        await saveCache();
        if (webhook) {
            await webhook.send(`New lab: [${name.replace(/_/g, ' ')}](<https://rti.etf.bg.ac.rs/labvezbe/?servis=${encodeURIComponent(name)}>)`);
        }
        if (regex && regex.exec(name)) {
            if (webhook) {
                await webhook.send('Attempting automatic signup...');
            }
            console.debug('Logging in...');
            await login();
            console.debug('Getting available terms...');
            const availableTerm = await getTerms(name);
            if (availableTerm) {
                console.debug('Available term:', availableTerm);
                await signup(name, availableTerm);
                console.debug('Signed up.');
                if (webhook) {
                    await webhook.send('Signup successful!');
                }
            } else if (webhook) {
                await webhook.send('No available terms to sign up for!');
            }
            console.debug('Automatic signup phase ended.');
        }
    } catch (error) {
        console.error(new Date(), 'An error occurred while recording lab:', error);
        if (webhook) {
            webhook.send('An error occurred while recording lab!');
        }
    }
}

/**
 * Refreshes the lab list.
 */
async function refresh() {
    try {
        await Promise.all(
            (await getServices())
                .filter(service => !cache.has(service))
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
                console.error(
                    new Date(),
                    'Unknown request error:',
                    error
                );
            }
        } else {
            console.error(
                new Date(),
                'An error occurred while refreshing service list:',
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
            cache = new Set(await getServices());
            await saveCache();
        } else {
            console.error('Error while loading cache:', error);
        }
    }
    await refresh();
    setInterval(refresh, interval);
    console.info('Service started.');
}

main();
