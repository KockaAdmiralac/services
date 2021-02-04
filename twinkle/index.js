#!/usr/bin/env node
/**
 * index.js
 *
 * Runs Twinkle but with modifications in plugins and commands.
 */
const path = require('path'),
      twinklePath = process.argv[2],
      Twinkle = require(`${twinklePath}/src/Twinkle.js`);

const client = new Twinkle();

client.loadPluginDir(path.join(twinklePath, 'src', 'plugins'));
client.loadPluginDir(path.join(__dirname, 'plugins'));

if (client.commander) {
    client.commander.loadCommandDir(path.join(twinklePath, 'src', 'plugins', 'commander', 'commands'));
    client.commander.loadCommandDir(path.join(__dirname, 'commands'));
}

client.login(client.config.TOKEN);
