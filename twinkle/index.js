#!/usr/bin/env node
/**
 * index.js
 *
 * Runs Twinkle but with modifications in plugins and commands.
 */
require('events').captureRejections = true;
const path = require('path');
const twinklePath = process.argv[2];
const Twinkle = require(`${twinklePath}/src/Twinkle.js`);

const client = new Twinkle();

client.loadPluginDir(path.join(twinklePath, 'src', 'plugins'));
client.loadPluginDir(path.join(__dirname, 'plugins'));

if (client.commander) {
    client.commander.loadCommandDir(path.join(twinklePath, 'src', 'plugins', 'commander', 'commands'));
    client.commander.loadCommandDir(path.join(__dirname, 'commands'));
}

client.login(client.config.TOKEN);

process.on('unhandledRejection', client.unhandledRejection.bind(client));
process.on('SIGINT', client.cleanup.bind(client));
