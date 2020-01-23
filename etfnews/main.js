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

let results = null;

function fetch() {
    const date = Date.now();
    return Promise.all(pages.map(u => http.get(u.url, {
        qs: {
            ...u.qs,
            t: date
        },
        transform: res => res
            .replace(new RegExp(date, 'g'), '')
            .replace(/<!--(.*?)-->/g, '')
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
            if (md5(results[i]) !== md5(res[i])) {
                const lineDiff = results[i].split('\n').length - res[i].split('\n').length;
                let relay = false;
                if (lineDiff < -5) {
                    // Large content removal.
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
                    relay = `\`\`\`diff\n${changedContent}\`\`\``;
                } else if (lineDiff < 50) {
                    // Medium content addition.
                    const addedContent = diffLines(results[i], res[i])
                        .filter(change => change.added)
                        .map(change => change.value)
                        .join('');
                    relay = h2m(addedContent);
                } else {
                    // Large content addition.
                    relay = 'Promene prevelike, ne može se generisati pregled.';
                }
                console.debug('Description to relay:', relay);
                if (typeof relay === 'string') {
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
            if (error.cause.errno === 'ECONNREFUSED') {
                console.error(new Date(), 'Connection refused on', error.options.uri);
            } else if (error.cause.errno === 'ECONNRESET') {
                console.error(new Date(), 'Connection reset on', error.options.uri);
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
