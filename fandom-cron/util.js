import {readFile} from 'fs/promises';

export async function login(username, password, http) {
    return http.post(`https://services.fandom.com/mobile-fandom-app/fandom-auth/login`, {
        form: {
            username,
            password
        }
    });
}

export async function login2FA(username, password, totp, http) {
    const loginInfo = await http.get('https://services.fandom.com/kratos-public/self-service/login/browser').json();
    try {
        // This is one of the stupidest logins imaginable.
        await http.post(loginInfo.ui.action, {
            json: {
                csrf_token: loginInfo.ui.nodes.find(n => n.attributes.name === 'csrf_token').attributes.value,
                password: password,
                identifier: username,
                method: 'password'
            }
        }).json();
    } catch (error) {
        if (!error || !error.response || error.response.statusCode !== 422) {
            throw error;
        }
    }
    const loginInfo2 = await http.get('https://services.fandom.com/kratos-public/self-service/login/browser', {
        searchParams: {
            aal: 'aal2'
        }
    }).json();
    await http.post(loginInfo2.ui.action, {
        json: {
            csrf_token: loginInfo2.ui.nodes.find(n => n.attributes.name === 'csrf_token').attributes.value,
            totp_code: totp,
            method: 'totp',
            lookup_secret: ''
        }
    }).json();
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
