#!/usr/bin/env node --experimental-json-modules
import {WebhookClient} from 'discord.js';
import got from 'got';
import imaps from 'imap-simple';
import config from './config.json' assert {type: 'json'};

const signedUp = new Set();
const seenUIDs = new Set();
const DOODLE_URL = /https:\/\/(www\.)?doodle.com\/poll\/([0-9a-zA-Z]+)/g;
const webhook = new WebhookClient(config.discord);
let timeoutCount = 0;

async function notify(text, error) {
    if (error) {
        console.error(new Date(), text, error);
    } else {
        console.info(new Date(), text);
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
            if (participants instanceof Array && participants.some(p => p.name === config.name)) {
                await notify('Already signed up.');
                signedUp.add(pollId);
                return;
            }
            const preferences = options
                .map(() => (levels === 'YESNOIFNEEDBE') ? 2 : 1);
            await got.post(`https://doodle.com/api/v2.0/polls/${pollId}/participants`, {
                json: {
                    name: config.name,
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

function connectionError(error) {
    return notify('Unhandled connection error', error);
}

async function interval() {
    try {
        const connection = await imaps.connect({imap: config.imap});
        connection.on('error', connectionError);
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
            const parts = imaps.getParts(message.attributes.struct);
            for (const part of parts) {
                const partData = await connection.getPartData(message, part);
                if (part.disposition === null && part.encoding !== 'base64') {
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
        connection.removeListener('error', connectionError);
        if (timeoutCount === 10) {
            await notify('Normal state is restored.');
        }
        timeoutCount = 0;
    } catch (error) {
        if (error instanceof imaps.errors.ConnectionTimeoutError || error.source === 'timeout') {
            if (++timeoutCount === 10) {
                await notify('The timeout count reached 10, will notify when normal state is restored.', error);
            }
        } else {
            await notify('Unhandled error', error);
        }
    }
}

setInterval(interval, config.intervalMs);
await notify('Service started.')
