#!/usr/bin/env node
const {WebhookClient} = require('discord.js');
const got = require('got');
const imaps = require('imap-simple');
const {discord, imap, intervalMs, name} = require('./config.json');
const signedUp = new Set();
const seenUIDs = new Set();
const DOODLE_URL = /https:\/\/(www\.)?doodle.com\/poll\/([0-9a-zA-Z]+)/g;
const webhook = new WebhookClient(discord);

async function notify(text, error) {
    if (error) {
        console.error(new Date(), text, error);
    } else {
        console.info(new Date(), text, error);
    }
    if (text.length) {
        await webhook.send({
            content: text
        });
    }
}

async function signUp(pollId) {
    if (signedUp.has(pollId)) {
        return;
    }
    for (let i = 0; i < 3; ++i) {
        try {
            await notify(`Signing up for ${pollId}...`);
            const {
                levels,
                options,
                optionsHash,
                participants
            } = await got(`https://doodle.com/api/v2.0/polls/${pollId}`).json();
            if (participants instanceof Array && participants.some(p => p.name === name)) {
                await notify('Already signed up.');
                signedUp.add(pollId);
                return;
            }
            const preferences = [];
            for (const option of options) {
                if (levels === 'YESNOIFNEEDBE') {
                    preferences.push(2);
                } else {
                    preferences.push(1);
                }
            }
            await got.post(`https://doodle.com/api/v2.0/polls/${pollId}/participants`, {
                json: {
                    name,
                    preferences,
                    participantKey: null,
                    optionsHash
                }
            });
            signedUp.add(pollId);
            await notify('Signed up.');
            return;
        } catch (error) {
            await notify(`Failed to sign up, attempt ${i + 1}`, error);
        }
    }
    await notify('Failed to sign up!');
}

async function interval() {
    try {
        const connection = await imaps.connect({imap});
        await connection.openBox('INBOX');
        const messages = await connection.search(['UNSEEN'], {
            bodies: ['TEXT'],
            struct: true
        });
        for (const message of messages) {
            if (seenUIDs.has(message.attributes.uid)) {
                continue;
            }
            await notify(`Processing message ${message.attributes.uid}...`);
            console.debug(message);
            const parts = imaps.getParts(message.attributes.struct);
            for (const part of parts) {
                const partData = await connection.getPartData(message, part);
                if (part.disposition === null && part.encoding !== 'base64') {
                    console.debug(partData);
                    for (const [_, __, pollId] of partData.matchAll(DOODLE_URL)) {
                        await signUp(pollId);
                    }
                }
            }
            seenUIDs.add(message.attributes.uid);
        }
        connection.imap.closeBox(true, async error => {
            if (error) {
                await notify('An error occurred while closing inbox', error);
            }
        });
        connection.end();
    } catch (error) {
        await notify('Unhandled error', error);
    }
}

async function main() {
    setInterval(interval, intervalMs);
    await notify('Service started.')
}

main();
