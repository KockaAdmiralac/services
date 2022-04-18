#!/usr/bin/env node
'use strict';
import got from 'got';
import {dirname} from 'path';
import {CookieJar} from 'tough-cookie';
import {fileURLToPath} from 'url';
import {login, getEditToken, readJSON} from './util.js';

const http = got.extend({
    cookieJar: new CookieJar(),
    headers: {
        'User-Agent': 'Kocka\'s Mass Database Dumper v1.0'
    },
    resolveBodyOnly: true,
    retry: 0
});

async function getDump(wiki, editToken) {
    return http.post(`https://${wiki}/wiki/Special:Statistics`, {
        form: {
            dumpDatabase: '1',
            dumpRequest: '1',
            editToken,
            wpEditToken: editToken
        }
    });
}

async function init() {
    console.info('Started.');
    const {username, password, wikis} = await readJSON(`${dirname(fileURLToPath(import.meta.url))}/dump.json`);
    console.info('Logging in...');
    try {
        await login(username, password, http);
    } catch (error) {
        console.error('An error occurred while logging in:', error);
        return;
    }
    for (const wiki of wikis) {
        try {
            console.info('Dumping', wiki, '...');
            await getDump(wiki, await getEditToken(wiki, http));
        } catch (error) {
            console.error('An error occurred while dumping', wiki, error);
        }
    }
    console.info('Done.');
}

init();
