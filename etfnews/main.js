#!/usr/bin/env node
'use strict';
const fs = require('fs'),
      http = require('request-promise-native'),
      {WebhookClient} = require('discord.js'),
      {pages, interval, discord} = require('./config.json'),
      md5 = require('md5'),
      {URL, URLSearchParams} = require('url'),
      {diffLines} = require('diff'),
      h2m = require('h2m'),
      webhook = new WebhookClient(discord.id, discord.token);

let results = null,
    counter = {};

function fetch() {
    const date = Date.now();
    return Promise.all(pages.map(u => http.get(u.url, {
        qs: {
            ...u.qs,
            t: date
        },
        transform: res => res
            .replace(new RegExp(date, 'g'), '')
            .replace(/<!--(.*?)-->/gs, '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join('\n')
    })));
}

async function refresh() {
    try {
        const res = await fetch();
        for (let i = 0; i < res.length; ++i) {
            if (!counter[i]) {
                counter[i] = 0;
            }
            if (md5(results[i]) !== md5(res[i])) {
                const lineDiff = results[i].split('\n').length - res[i].split('\n').length;
                let relay = false;
                if (lineDiff < -5) {
                    // Large content removal.
                    if (--counter[i] === -5) {
                        relay = 'Prevelike izmene, ne može se generisati pregled. (-)';
                    }
                    console.info(new Date(), `Server at ${pages[i].url} returned an empty page, ignoring.`);
                } else if (lineDiff < 5) {
                    // Small content addition or removal.
                    const changedContent = diffLines(results[i], res[i])
                        .filter(change => change.added || change.removed)
                        .map(change => change.value
                            .trim()
                            .split('\n')
                            .map(line => `${change.added ? '+' : '-'} ${line}`)
                            .join('\n')
                        )
                        .join('\n');
                    if (changedContent.trim().length) {
                        relay = `\`\`\`diff\n${changedContent}\`\`\``;
                    } else {
                        console.debug(new Date(), 'But the changes weren\'t there.');
                    }
                } else if (lineDiff < 30) {
                    // Medium content addition.
                    const addedContent = diffLines(results[i], res[i])
                        .filter(change => change.added)
                        .map(change => change.value)
                        .join('');
                    relay = h2m(addedContent);
                } else {
                    // Large content addition.
                    if (++counter[i] === 5) {
                        relay = 'Prevelike izmene, ne može se generisati pregled. (+)';
                    }
                    console.log(new Date(), `Server at ${pages[i].url} added a large amount of content.`);
                }
                if (typeof relay === 'string') {
                    counter[i] = 0;
                    await fs.promises.writeFile(`hist/${pages[i].key}/${Date.now()}.html`, res[i]);
                    const url = new URL(pages[i].url);
                    url.search = new URLSearchParams(pages[i].qs);
                    await webhook.send('', {
                        embeds: [
                            {
                                color: 0x00658F,
                                description: relay,
                                footer: {
                                    icon_url: 'https://pbs.twimg.com/profile_images/3588382817/fc429cf1113d956cee2e85b503b0cfc4.jpeg',
                                    text: 'ETF News'
                                },
                                timestamp: new Date().toISOString(),
                                title: `Stranica '${pages[i].title || pages[i].url}' ažurirana!`,
                                url: url.toString()
                            }
                        ]
                    });
                    results[i] = res[i];
                }
            }
        }
    } catch (error) {
        if (error && error.name === 'RequestError' && error.cause) {
            if (error.cause.code === 'ECONNREFUSED') {
                console.error(new Date(), 'Connection refused on', error.options.uri);
            } else if (error.cause.code === 'ECONNRESET') {
                console.error(new Date(), 'Connection reset on', error.options.uri);
            } else if (error.cause.code === 'EHOSTUNREACH') {
                console.error(new Date(), 'Host at', error.options.uri, 'is unreachable');
            } else if (error.cause.code === 'ETIMEDOUT') {
                console.error(new Date(), 'Connection timed out on', error.options.uri);
            } else {
                console.error(new Date(), 'Unknown request error:', error);
            }
        } else {
            console.error(new Date(), error);
        }
    }
}

async function main() {
    await Promise.all(pages.map(p => fs.promises.mkdir(`hist/${p.key}`, {
        recursive: true
    })));
    results = await fetch();
    await results.map((res, i) => fs.promises.writeFile(`hist/${pages[i].key}/${Date.now()}.html`, res));
    await refresh();
    setInterval(refresh, interval);
}

main();
