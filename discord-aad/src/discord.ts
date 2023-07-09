/**
 * @see https://github.com/discord/linked-roles-sample/blob/main/src/discord.js
 */
'use strict';

import {Env} from './worker';

/**
 * Generate the URL which the user will be directed to in order to approve the
 * bot, and see the list of requested scopes.
 * @param env Environment variables with required configuration
 * @returns User state as well as the OAuth2 URL
 */
export function getOAuthUrl(env: Env): {state: string, url: string} {
    const state = crypto.randomUUID();
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'role_connections.write identify');
    url.searchParams.set('prompt', 'consent');
    return {
        state,
        url: url.toString()
    };
}

/**
 * Given an OAuth2 code from the scope approval page, make a request to
 * Discord's OAuth2 service to retrieve an access token.
 * @param env Environment variables with required configuration
 * @param code Code from the OAuth2 approval
 * @returns The retrieved access token
 */
export async function getAccessToken(env: Env, code: string): Promise<string> {
    const url = 'https://discord.com/api/v10/oauth2/token';
    const body = new URLSearchParams({
        // eslint-disable-next-line camelcase
        client_id: env.DISCORD_CLIENT_ID,
        // eslint-disable-next-line camelcase
        client_secret: env.DISCORD_CLIENT_SECRET,
        code,
        // eslint-disable-next-line camelcase
        grant_type: 'authorization_code',
        // eslint-disable-next-line camelcase
        redirect_uri: env.DISCORD_REDIRECT_URI
    });
    const response = await fetch(url, {
        body,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST'
    });
    if (!response.ok) {
        throw new Error(`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`);
    }
    const tokens: any = await response.json();
    return tokens.access_token;
}

/**
 * Given a user based access token, fetch the current user's ID.
 * @param accessToken User's access token
 * @returns User's ID
 */
export async function getUserId(accessToken: string): Promise<string> {
    const url = 'https://discord.com/api/v10/oauth2/@me';
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
    if (!response.ok) {
        throw new Error(`Error fetching user data: [${response.status}] ${response.statusText}`);
    }
    const jsonData: any = await response.json();
    return jsonData.user.id;
}

/**
 * Given metadata that matches the schema, push that data to Discord on behalf
 * of the current user.
 * @param env Environment variables with required configuration
 * @param accessToken User's access token
 */
export async function pushMetadata(
    env: Env,
    accessToken: string
): Promise<void> {
    const url = `https://discord.com/api/v10/users/@me/applications/${env.DISCORD_CLIENT_ID}/role-connection`;
    const response = await fetch(url, {
        body: JSON.stringify({
            metadata: {},
            // eslint-disable-next-line camelcase
            platform_name: env.DISCORD_PLATFORM_NAME
        }),
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        method: 'PUT'
    });
    if (!response.ok) {
        throw new Error(`Error pushing Discord metadata: [${response.status}] ${response.statusText}`);
    }
}

/**
 * Changes the user's nickname to their AAD name after authentication.
 * @param env Environment variables with required configuration
 * @param discordId User's Discord ID
 * @param name User's AAD name
 */
export async function changeNickname(
    env: Env,
    discordId: string,
    name: string
): Promise<void> {
    const url = `https://discord.com/api/guilds/${env.DISCORD_GUILD_ID}/members/${discordId}`;
    const response = await fetch(url, {
        body: JSON.stringify({
            nick: name
        }),
        headers: {
            'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': 'Successful AAD authentication.'
        },
        method: 'PATCH'
    });
    if (!response.ok) {
        throw new Error(`Error changing nickname: [${response.status}] ${response.statusText}`);
    }
}

/**
 * Posts a message in a Discord channel through a bot.
 * @param env Environment variables with required configuration
 * @param text Message to post in the channel
 */
export async function postInChannel(env: Env, text: string): Promise<void> {
    const url = `https://discord.com/api/channels/${env.DISCORD_LOG_CHANNEL_ID}/messages`;
    const response = await fetch(url, {
        body: JSON.stringify({
            content: text
        }),
        headers: {
            'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json'
        },
        method: 'POST'
    });
    if (!response.ok) {
        throw new Error(`Error posting message: [${response.status}] ${response.statusText}`);
    }
}
