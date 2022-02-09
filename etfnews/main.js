#!/usr/bin/env node
/**
 * main.js
 *
 * Main entry point of ETFNews.
 */
import {readFile, writeFile} from 'fs/promises';
import ETFNews from './include/etfnews.js';

let etfnews = null;

/**
 * Loads etfnews configuration from `config.json`.
 * @returns {object} etfnews configuration object
 */
async function loadConfig() {
    return JSON.parse(await readFile('config.json', {
        encoding: 'utf-8'
    }));
}

/**
 * Kills the etfnews agent and exits etfnews.
 */
process.on('SIGINT', async function() {
    if (etfnews === null) {
        return;
    }
    console.info('Received kill signal, exiting...');
    try {
        await etfnews.kill();
    } catch (error) {
        console.error('Failed to kill agent:', error);
        return;
    }
    console.info('Agent killed.');
});

/**
 * Reloads the etfnews agent's configuration.
 * This currently kills the agent and restarts it.
 */
process.on('SIGHUP', async function() {
    if (etfnews === null) {
        return;
    }
    console.info('Reloading agent...');
    try {
        await etfnews.kill();
    } catch (error) {
        console.error('Failed to kill agent:', error);
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
        etfnews = new ETFNews(config);
    } catch (error) {
        console.error('Failed to reconfigure agent:', error);
        return;
    }
    console.info('Agent reloaded.');
});

console.info('ETFNews starting...');
await writeFile('main.pid', process.pid.toString());
let config;
try {
    config = await loadConfig();
} catch (error) {
    if (error && error.code === 'ENOENT') {
        console.error('Configuration was not found. Please make sure the sample configuration has been renamed or copied to `config.json`.');
    } else {
        console.error('Failed to load configuration:', error);
    }
    process.exit(1);
}
try {
    etfnews = new ETFNews(config);
    await etfnews.init();
} catch (error) {
    console.error('Failed to configure agent:', error);
    process.exit(1);
}
console.info('Agent started.');
