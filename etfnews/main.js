#!/usr/bin/env node
/**
 * main.js
 *
 * Main entry point of ETFNews.
 */
'use strict';

/**
 * Importing modules.
 */
const fs = require('fs'),
      ETFNews = require('./include/etfnews.js');

let etfnews = null;

/**
 * Loads etfnews configuration from `config.json`.
 * @returns {object} etfnews configuration object
 */
async function loadConfig() {
    return JSON.parse(await fs.promises.readFile('config.json', {
        encoding: 'utf-8'
    }));
}

/**
 * Kills the etfnews agent and exits etfnews.
 */
async function kill() {
    if (etfnews != null) {
        console.info('Received kill signal, exiting...');
        try {
            await etfnews.kill();
        } catch (error) {
            console.error('Failed to kill agent:', error);
            return;
        }
        console.info('Agent killed.');
    }
}

/**
 * Reloads the etfnews agent's configuration.
 * This currently kills the agent and restarts it.
 */
async function reload() {
    if (etfnews != null) {
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
    }
}

/**
 * Asynchronous entry point.
 */
async function main() {
    console.info('ETFNews starting...');
    await fs.promises.writeFile('main.pid', process.pid.toString());
    let config;
    try {
        config = await loadConfig();
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            console.error('Configuration was not found. Please make sure the sample configuration has been renamed or copied to `config.json`.');
        } else {
            console.error('Failed to load configuration:', error);
        }
        return;
    }
    try {
        etfnews = new ETFNews(config);
    } catch (error) {
        console.error('Failed to configure agent:', error);
        return;
    }
    console.info('Agent started.');
    process.on('SIGINT', kill);
    process.on('SIGHUP', reload);
}

main();
