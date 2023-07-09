'use strict';

import {Env} from './worker';

/**
 * Generate the URL which the user will be directed to in order to authorize
 * access to AAD data, and see the list of requested scopes.
 * @param env Environment variables with required configuration
 * @param state User's state from Discord authentication
 * @returns OAuth2 URL for Azure Active Directory
 */
export function getOAuthUrl(env: Env, state: string): string {
    const url = new URL(`https://login.microsoftonline.com/${env.AAD_TENANT_ID}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', env.AAD_CLIENT_ID);
    url.searchParams.set('scope', 'https://graph.microsoft.com/user.read');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('state', state);
    return url.toString();
}

/**
 * Forms a proper response to the user based on the AAD error response.
 * @param code Error code
 * @param url Current request URL
 * @returns Response to the AAD authentication error
 */
export function getAADErrorResponse(code: string, url: string): Response {
    switch (code) {
        case 'invalid_request': return new Response(
            'Whoops! We messed up the request.',
            {status: 500}
        );
        case 'unauthorized_client': return new Response(
            'Whoops! Our AAD application is not properly authorized.',
            {status: 500}
        );
        case 'access_denied': return new Response(
            'You denied the authorization request.',
            {status: 400}
        );
        case 'unsupported_response_type': return new Response(
            'Whoops! We are using an unsupported response type.',
            {status: 500}
        );
        case 'server_error': return new Response(
            'There was a server error at Microsoft, please retry your request.',
            {status: 500}
        );
        case 'temporarily_unavailable': return new Response(
            'Servers at Microsoft are too busy, please retry your request.',
            {status: 500}
        );
        case 'invalid_resource':
        case 'login_required':
        case 'interaction_required':
        default:
            console.error(url);
            return new Response('What?', {status: 500});
    }
}

/**
 * Retrieves data from the user's JWT after receiving the OAuth code.
 * @param env Environment variables with required configuration
 * @param code OAuth code
 * @returns Data from the user's JWT
 * @todo Microsoft tells us not to do this, but...
 */
export async function getUserJWTData(
    env: Env,
    code: string
): Promise<{email: string, name: string}> {
    const tokenUrl = `https://login.microsoftonline.com/${env.AAD_TENANT_ID}/oauth2/v2.0/token`;
    const tokenForm = new FormData();
    tokenForm.append('client_id', env.AAD_CLIENT_ID);
    tokenForm.append('code', code);
    tokenForm.append('grant_type', 'authorization_code');
    tokenForm.append('scope', 'https://graph.microsoft.com/user.read');
    tokenForm.append('client_secret', env.AAD_CLIENT_SECRET);
    const response = await fetch(tokenUrl, {
        body: tokenForm,
        method: 'POST'
    });
    if (!response.ok) {
        throw new Error(`Error fetching AAD data: [${response.status}] ${response.statusText}`);
    }
    const responseJson: any = await response.json();
    const [_, encodedJWT] = responseJson.access_token.split('.');
    const binaryDecodedJWT = atob(encodedJWT)
        .split('')
        .map(m => m.codePointAt(0) || 0);
    const decodedJWT = new TextDecoder()
        .decode(Uint8Array.from(binaryDecodedJWT, n => n));
    const jwt = JSON.parse(decodedJWT);
    return {
        email: jwt.unique_name,
        name: jwt.name
    };
}
