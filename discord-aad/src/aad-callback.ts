'use strict';

import {changeNickname, postInChannel, pushMetadata} from './discord';
import {getAADErrorResponse, getUserJWTData} from './aad';
import {verifyCodeAndState, verifyEmail} from './util';
import {Env} from './worker';

/**
 * Handles the callback after the user authenticates to AAD.
 * @param request Request data
 * @param env Environment data
 * @param _ctx Execution context
 * @returns Response data
 */
export async function aadCallback(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
): Promise<Response> {
    const url = new URL(request.url);
    const error = url.searchParams.get('error');
    if (error) {
        return getAADErrorResponse(error, request.url);
    }
    const verification = verifyCodeAndState(request);
    if (verification.error) {
        return verification.error;
    }
    const {code, state} = verification;
    const discordKey = `discord:${state}`;
    const discordIdAndToken = await env.DISCORD_AAD.get(discordKey);
    if (!discordIdAndToken) {
        return new Response('No associated Discord user with you. Try again?', {
            status: 403
        });
    }
    await env.DISCORD_AAD.delete(discordKey);
    const {id, token} = JSON.parse(discordIdAndToken);
    const {email, name} = await getUserJWTData(env, code);
    await env.DISCORD_AAD.put(`aad:${id}`, JSON.stringify({
        email,
        name
    }));
    await postInChannel(env, `User <@${id}> verified as ${name} (${email}).`);
    const emailVerificationError = verifyEmail(env, email);
    if (emailVerificationError) {
        return emailVerificationError;
    }
    await pushMetadata(env, token);
    try {
        await changeNickname(env, id, name);
    } catch (nicknameChangeError) {
        // Oh well!
        console.error(nicknameChangeError);
    }
    return new Response(`Hello ${name}! You can return to Discord now.`);
}
