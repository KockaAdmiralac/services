'use strict';

import {getAccessToken, getUserId} from './discord';
import {Env} from './worker';
import {getOAuthUrl} from './aad';
import {verifyCodeAndState} from './util';

/**
 * Handles the callback after the user authenticates to AAD.
 * @param request Request data
 * @param env Environment data
 * @param _ctx Execution context
 * @returns Response data
 */
export async function discordCallback(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
): Promise<Response> {
    const verification = verifyCodeAndState(request);
    if (verification.error) {
        return verification.error;
    }
    const {code, state} = verification;
    const accessToken = await getAccessToken(env, code);
    const userId = await getUserId(accessToken);
    await env.DISCORD_AAD.put(`discord:${state}`, JSON.stringify({
        id: userId,
        token: accessToken
    }), {
        expirationTtl: 5 * 60
    });
    return new Response(null, {
        headers: {
            Location: getOAuthUrl(env, state)
        },
        status: 302
    });
}
