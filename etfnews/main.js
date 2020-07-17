#!/usr/bin/env node
/**
 * main.js
 *
 * Entry point of ETFNews.
 */
'use strict';

/**
 * Importing modules.
 */
const fs = require('fs'),
      ETFNews = require('./include/etfnews.js');

let client = null;

/**
 * Loads ETFNews configuration.
 */
async function loadConfig() {
    return JSON.parse(await fs.promises.readFile('config.json', {
        encoding: 'utf-8'
    }));
}

/**
 * Kills the client and exits ETFNews.
 */
async function kill() {
    if (client != null) {
        console.info('Received kill signal, exiting...');
        try {
            await client.kill();
        } catch (error) {
            console.error('Failed to kill client:', error);
            return;
        }
        console.info('Client killed.');
    }
}

/**
 * Reloads the client.
 */
async function reload() {
    if (client != null) {
        console.info('Reloading client...');
        try {
            await client.kill();
        } catch (error) {
            console.error('Failed to kill client:', error);
            return;
        }
        let config;
        try {
            config = await loadConfig();
        } catch (error) {
            console.error('Failed to reload configuration:', error);
            return;
        }
        try {
            client = new ETFNews(config);
        } catch (error) {
            console.error('Failed to reconfigure client:', error);
            return;
        }
        console.info('Client reloaded.');
    }
}

/**
 * Main function.
 */
async function main() {
    console.info('ETFNews starting...');
    await fs.promises.writeFile('main.pid', process.pid.toString());
    let config;
    try {
        config = await loadConfig();
    } catch (error) {
        console.error('Failed to load configuration:', error);
        return;
    }
    try {
        client = new ETFNews(config);
    } catch (error) {
        console.error('Failed to configure client:', error);
        return;
    }
    console.info('Client started.');
    process.on('SIGINT', kill);
    process.on('SIGHUP', reload);
}

main();
