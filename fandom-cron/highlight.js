#!/usr/bin/env node
'use strict';
import got from 'got';
import parser from 'node-html-parser';
import {dirname} from 'path';
import {CookieJar} from 'tough-cookie';
import {fileURLToPath} from 'url';
import {loginAllDomains, getContent, getEditToken, readJSON} from './util.js';

const http = got.extend({
    cookieJar: new CookieJar(),
    headers: {
        'User-Agent': 'Highlight.css updater'
    },
    resolveBodyOnly: true,
    retry: 0
});

async function getUsers({groups, overrides}) {
    const users = {};
    const searchParams = {};
    let index = 0;
    for (const group in groups) {
        searchParams[`groups[${index++}]`] = group;
        users[group] = [];
    }
    const html = await http.get('https://dev.fandom.com/wiki/Special:ListGlobalUsers', {searchParams});
    const tree = parser.parse(html);
    for (const node of tree.querySelectorAll('.list-global-users-members > li')) {
        const name = node.querySelector('bdi').innerText;
        const userGroups = node.innerText
            .trim()
            .match(/\(([^)]+)\)$/)[1]
            .split(', ');
        if (userGroups.includes('bot-global')) {
            continue;
        }
        const toRemove = new Set(overrides.remove[name] || []);
        for (const group of userGroups) {
            if (users[group] && !toRemove.has(group)) {
                users[group].push(name);
            }
        }
    }
    for (const user in overrides.add) {
        for (const group of overrides.add[user]) {
            if (users[group] && !users[group].includes(user)) {
                users[group].push(user);
            }
        }
    }
    return users;
}

function wikiUrlencode(str) {
    return encodeURIComponent(str)
        .replace(/'/g, '%27')
        .replace(/%20/g, '_')
        .replace(/%3B/g, ';')
        .replace(/%40/g, '@')
        .replace(/%24/g, '$')
        .replace(/%2C/g, ',')
        .replace(/%2F/g, '/')
        .replace(/%3A/g, ':');
}

function getSelectorsFor(users) {
    const encode = [];
    for (const user of users) {
        const regularEncode = user.replace(/\s/g, '_');
        const wikiEncode = wikiUrlencode(user);
        encode.push(regularEncode);
        if (regularEncode !== wikiEncode) {
            encode.push(wikiEncode);
        }
    }
    return encode
        .map(sel => 'a[href$=":' + sel + '"]')
        .join(',\n');
}

function edit(text, token) {
    return http.post(`https://dev.fandom.com/api.php`, {
        form: {
            action: 'edit',
            bot: true,
            text,
            title: 'MediaWiki:Highlight.css',
            minor: true,
            summary: 'Automatically updating via [[github:KockaAdmiralac/services/blob/master/fandom-cron/highlight.js|highlight.js]]',
            token,
            format: 'json'
        },
        responseType: 'json'
    });
}

async function init() {
    console.info('Started.');
    const {username, password} = await readJSON(`${dirname(fileURLToPath(import.meta.url))}/highlight.json`);
    console.info('Logging in...');
    await loginAllDomains(username, password, http);
    console.info('Grabbing config and CSS contents...');
    const [highlight, configContents] = await getContent('dev.fandom.com', [
        'MediaWiki:Highlight.css',
        'MediaWiki:Custom-Highlight.json'
    ], http);
    console.info('Processing content...');
    const config = JSON.parse(configContents);
    const users = await getUsers(config);
    const css = Object.keys(users)
        .filter(group => users[group].length > 0)
        .map(group => `/* ${group} */\n${getSelectorsFor(users[group].sort())} {\n    color: ${config.groups[group].color} !important;\n    color: var(--highlight-${config.groups[group].cssVar}) !important;\n}`)
        .join('\n\n');
    const text = highlight.replace(/(\/\* HighlightUpdate-start \*\/\n)[\s\S]*$/igm, (_, m) => `${m}${css}`);
    console.info('Saving page...');
    await edit(text, await getEditToken('dev.fandom.com', http));
    console.info('Done.');
}

init();
