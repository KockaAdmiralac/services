'use strict';

import {Env} from './worker';
import {getOAuthUrl} from './discord';

/**
 * Initiates the role linking flow.
 * @param request Request data
 * @param env Environment data
 * @param _ctx Execution context
 * @returns Response data
 */
export function start(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
): Response {
    const currentURL = new URL(request.url);
    const {state, url} = getOAuthUrl(env);
    const stateCookieMaxAge = 5 * 60 * 1000;
    return new Response(null, {
        headers: {
            'Location': url,
            'Set-Cookie': `state=${state}; Max-Age=${stateCookieMaxAge}; Domain=${currentURL.host}; Secure; HttpOnly`
        },
        status: 302
    });
}
