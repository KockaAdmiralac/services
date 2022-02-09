#!/usr/bin/env node
import {WebhookClient} from 'discord.js';
import {readFile, writeFile} from 'fs/promises';
import ETFClient from '../etf-proxy/client.js';
import {promisify} from 'util';

let webhook, reservations;

const http = new ETFClient({
    headers: {
        'User-Agent': 'Proveravanje rezervisanih sala'
    },
    prefixUrl: 'https://rti.etf.bg.ac.rs/sale/',
    resolveBodyOnly: true
});
const LINE_REGEX = /<tr class="tablica(?:0|1|Vikend|Danas).*/g;
const TERM_REGEX = /class='zauzete' id='[^']*'><center>([^<]+)/g;
const ROOMS = ['25', '26', '60', '26B', '70', '314', '315'];
const INTERVAL = 60 * 60 * 1000;
const wait = promisify(setTimeout);

function serialize({author, day, month, name, room, time, year}) {
    return `${author}:${day}:${month}:${name}:${room}:${time}:${year}`;
}

async function readJSON(path) {
    try {
        return JSON.parse(await readFile(path, {
            encoding: 'utf-8'
        }));
    } catch (error) {
        return null;
    }
}

async function report(text, error) {
    console.info(new Date(), text, error);
    try {
        await webhook.send({
            content: text
        });
    } catch (discordError) {
        console.info(new Date(), 'Error while relaying:', discordError);
    }
}

async function getReserved(room, month, year) {
    const reserved = [];
    const response = await http.get('index.php', {
        searchParams: {
            godina: year,
            mesec: month,
            sala: room,
            t: Date.now()
        }
    });
    for (const [num, line] of response.match(LINE_REGEX).entries()) {
        for (const match of line.match(TERM_REGEX) || []) {
            const [time, author, name] = TERM_REGEX.exec(match)[1].split(': ');
            TERM_REGEX.lastIndex = 0;
            reserved.push({
                author,
                day: num + 1,
                month,
                name,
                room,
                time,
                year
            });
        }
    }
    return reserved;
}

async function getAllReserved() {
    const reserved = [];
    const currDate = new Date();
    const currMonth = currDate.getMonth();
    const currYear = currDate.getFullYear();
    const nextMonths = Array(6)
        .fill()
        .map((_, index) => currMonth + index)
        .map(month => [
            month % 12 + 1,
            currYear + Math.floor(month / 12)
        ]);
    for (const [month, year] of nextMonths) {
        for (const room of ROOMS) {
            reserved.push(...await getReserved(room, month, year));
        }
    }
    return reserved;
}

function combine(reservations) {
    const combinedReservations = {};
    // TODO: This assumes the server is in the same timezone as Belgrade!
    for (const {author, day, month, name, room, time, year} of reservations) {
        const fallbackName = name || 'Untitled';
        const fallbackAuthor = author || 'Unknown author';
        const reservationKey = `${fallbackAuthor}:${fallbackName}`;
        const [startTime, endTime] = time.split('-');
        const startDate = new Date(`${year}-${month}-${day} ${startTime}`);
        const endDate = new Date(`${year}-${month}-${day} ${endTime}`);
        const start = startDate.getTime() / 1000;
        const end = endDate.getTime() / 1000;
        if (!combinedReservations[reservationKey]) {
            combinedReservations[reservationKey] = {
                author: fallbackAuthor,
                name: fallbackName,
                terms: []
            };
        }
        combinedReservations[reservationKey].terms.push({room, start, end});
    }
    return Object.values(combinedReservations);
}

async function recheck(first) {
    try {
        const separateReservations = [];
        // Filter out already recorded terms.
        for (const reservation of await getAllReserved()) {
            const serialized = serialize(reservation);
            if (!reservations.has(serialized)) {
                reservations.add(serialized);
                separateReservations.push(reservation);
            }
        }
        // Combine reservations into embeds.
        const embeds = combine(separateReservations).map(({author, name, terms}) => ({
            author: {
                name: author || 'Unknown author'
            },
            description: terms
                .map(({room, start, end}) => `• room ${room}: <t:${start}:f> - <t:${end}:f>`)
                .join('\n')
                .slice(0, 2000),
            title: name || 'Untitled'
        }))
        // Save cache.
        if (embeds.length) {
            await writeFile('cache.json', JSON.stringify(Array.from(reservations)), {
                encoding: 'utf-8'
            });
        }
        // Relay all embeds, 10 by 10.
        while (embeds.length && !first) {
            await webhook.send({
                embeds: embeds.splice(0, 10)
            });
        }
    } catch (error) {
        await report('Error while fetching reservations.', error);
    }
}

const config = await readJSON('config.json');
if (!config) {
    console.error('No configuration present, exiting.');
    process.exit(1);
}
const {id, token} = config;
webhook = new WebhookClient({id, token});
reservations = new Set(await readJSON('cache.json') || []);
await recheck(reservations.length === 0);
await report('Service started.');
while (true) {
    await wait(INTERVAL);
    await recheck();
}
