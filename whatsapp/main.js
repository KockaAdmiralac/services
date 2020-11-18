#!/usr/bin/env node
/**
 * main.js
 *
 * Entry point for the relay.
 */
'use strict';
const WhatsAppDiscord = require('./index.js');

const relay = new WhatsAppDiscord();
relay.run();
process.on('SIGINT', relay.kill.bind(relay));
process.on('SIGTERM', relay.kill.bind(relay));
process.on('SIGUSR2', relay.dumpChats.bind(relay));
process.on('unhandledRejection', relay.error.bind(relay));
