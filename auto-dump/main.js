#!/usr/bin/env node
'use strict';
const {CookieJar} = require('tough-cookie'),
      http = require('got').extend({
          cookieJar: new CookieJar(),
          headers: {
              'User-Agent': 'Kocka\'s Mass Database Dumper v1.0'
          },
          resolveBodyOnly: true,
          retry: 0
      }),
      config = require('./config.json');

async function login(domain) {
    return http.post(`https://services.${domain}/auth/token`, {
        form: {
            username: config.username,
            password: config.password
        }
    });
}

async function getEditToken(w) {
    return http.get(`https://${w}/api.php`, {
        hooks: {
            afterResponse: [
                function(response) {
                    const editToken = response.body.query.pages ?
                        // Legacy
                        response.body.query.pages[-1].edittoken :
                        // UCP
                        response.body.query.tokens.csrftoken;
                    response.body = editToken;
                    return response;
                }
            ]
        },
        responseType: 'json',
        searchParams: {
            action: 'query',
            titles: '#',
            meta: 'tokens',
            prop: 'info',
            intoken: 'edit',
            format: 'json'
        }
    });
}

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

