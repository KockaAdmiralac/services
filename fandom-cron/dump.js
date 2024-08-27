#!/usr/bin/env node
'use strict';
import got from 'got';
import {dirname} from 'path';
import {CookieJar} from 'tough-cookie';
import {FileCookieStore} from 'tough-cookie-file-store';
import {fileURLToPath} from 'url';
import {login2FA, getEditToken, readJSON} from './util.js';
import {createInterface} from 'readline';
import {exit, stdin, stdout} from 'process';
import {promisify} from 'util';

const cookieJar = new CookieJar(new FileCookieStore('fandom.cookies'));
const totpInput = createInterface({
    input: stdin,
    output: stdout
});
const question = promisify(totpInput.question).bind(totpInput);

const http = got.extend({
    cookieJar,
    headers: {
        'User-Agent': 'Kocka\'s Mass Database Dumper v1.0'
    },
    resolveBodyOnly: true,
    retry: {
        limit: 0
    }
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

async function whoami() {
    try {
        const response = await http.get('https://services.fandom.com/whoami').json();
        return response.userId;
    } catch (error) {
        return 0;
    }
}

async function init() {
    console.info('Started.');
    const {username, password, wikis} = await readJSON(`${dirname(fileURLToPath(import.meta.url))}/dump.json`);
    if (!await whoami()) {
        if (!stdin.isTTY) {
            console.error('Please log in through a terminal!');
            exit(1);
        }
        await cookieJar.removeAllCookies();
        console.info('Logging in...');
        const totp = await question('TOTP code: ');
        try {
            await login2FA(username, password, totp, http);
        } catch (error) {
            console.error('An error occurred while logging in:', error);
            exit(1);
        }
    }
    for (const wiki of wikis) {
        try {
            console.info('Dumping', wiki, '...');
            const editToken = await getEditToken(wiki, http);
            if (editToken === '+\\') {
                console.warn('WARNING: You might not be logged in!');
            }
            await getDump(wiki, editToken);
        } catch (error) {
            console.error('An error occurred while dumping', wiki, error);
        }
    }
    console.info('Done.');
    totpInput.close();
}

init();
