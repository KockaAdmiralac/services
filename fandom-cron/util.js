import {readFile} from 'fs/promises';

export async function login(username, password, http) {
    return http.post(`https://services.fandom.com/mobile-fandom-app/fandom-auth/login`, {
        form: {
            username,
            password
        },
        headers: {
            'X-Fandom-Auth': 1,
            'X-Wikia-WikiaAppsId': 1234
        }
    });
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
