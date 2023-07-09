'use strict';

import {aadCallback} from './aad-callback';
import {discordCallback} from './discord-callback';
import {start} from './start';

export interface Env {
    AAD_TENANT_ID: string;
    AAD_CLIENT_ID: string;
    AAD_CLIENT_SECRET: string;
    AAD_EMAIL_REGEX: string;
    AAD_DENYLIST: string;
    DISCORD_AAD: KVNamespace;
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_REDIRECT_URI: string;
    DISCORD_PLATFORM_NAME: string;
    DISCORD_GUILD_ID: string;
    DISCORD_BOT_TOKEN: string;
    DISCORD_LOG_CHANNEL_ID: string;
}

/**
 * Entry point for Cloudflare Workers.
 * @param request Request data
 * @param env Environment data
 * @param ctx Execution context
 * @returns Response data
 */
async function fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const url = new URL(request.url);
    let response: Response = new Response(null, {
        status: 204
    });
    switch (url.pathname) {
        case '/':
            response = start(request, env, ctx);
            break;
        case '/discord':
            response = await discordCallback(request, env, ctx);
            break;
        case '/aad':
            response = await aadCallback(request, env, ctx);
            break;
        default: break;
    }
    return response;
}

export default {fetch};
