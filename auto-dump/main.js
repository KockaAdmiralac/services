#!/usr/bin/env node
'use strict';
const http = require('request-promise-native'),
      config = require('./config.json'),
      jar = http.jar(),
      UA = 'Kocka\'s Mass Database Dumper v1.0';

async function login(domain) {
    return http({
        headers: {
            'User-Agent': UA
        },
        uri: `https://services.${domain}/auth/token`,
        method: 'POST',
        form: {
            username: config.username,
            password: config.password
        },
        jar
    });
}

async function getEditToken(w) {
    return http({
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': UA
        },
        method: 'GET',
        uri: `https://${w}/api.php`,
        qs: {
            action: 'query',
            titles: '#',
            prop: 'info',
            intoken: 'edit',
            format: 'json'
        },
        transform: d => d.query.pages[-1].edittoken,
        jar,
        json: true
    });
}

async function getDump(wiki, editToken) {
    return http({
        headers: {
            'User-Agent': UA
        },
        method: 'POST',
        uri: `https://${wiki}/wiki/Special:Statistics`,
        form: {
            dumpRequest: '1',
            editToken
        },
        jar
    });
}

async function init() {
    console.info('Logging in...');
    try {
        await login('fandom.com');
        await login('wikia.org');
    } catch (error) {
        console.error('An error occurred while logging in:', error);
    }
    for (const wiki of config.wikis) {
        try {
            console.log('Dumping', wiki, '...');
            await getDump(wiki, await getEditToken(wiki));
        } catch (error) {
            console.error('An error occurred while dumping', wiki, error);
        }
    }
    console.info('Done.');
}

init();

