import {readFile} from 'fs/promises';

export async function login(username, password, http, domain) {
    return http.post(`https://services.${domain}/auth/token`, {
        form: {
            username,
            password
        },
        headers: {
            'X-Wikia-WikiaAppsId': 1234
        }
    });
}

export function loginAllDomains(username, password, http) {
    return Promise.all([
        login(username, password, http, 'fandom.com'),
        login(username, password, http, 'wikia.org')
    ]);
}

export async function getEditToken(url, http) {
    const response = await http.get(`https://${url}/api.php`, {
        responseType: 'json',
        searchParams: {
            action: 'query',
            meta: 'tokens',
            format: 'json'
        }
    });
    return response.query.tokens.csrftoken;
}

export async function getContent(url, pages, http) {
    const response = await http.get(`https://${url}/api.php`, {
        responseType: 'json',
        searchParams: {
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            rvslots: 'main',
            titles: pages.join('|'),    
            format: 'json'
        }
    });
    return Object.values(response.query.pages)
        .map(page => page.revisions[0].slots.main['*']);
}

export async function readJSON(file) {
    return JSON.parse(await readFile(file, {
        encoding: 'utf-8'
    }));
}
