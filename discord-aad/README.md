# discord-aad
Allows role linking on Discord with Azure Active Directory. Made for deployment to [Cloudflare Workers](https://workers.cloudflare.com/).

## Setup
The setup guide below assumes you are mildly familiar with Cloudflare Workers, Discord and Azure Active Directory as development platforms.

1. Azure Active Directory side:
    1. [Create an Azure Active Directory OAuth application](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
    2. From the Overview tab, copy the client ID to your `AAD_CLIENT_ID` secret, and the tenant ID to your `AAD_TENANT_ID` secret
    3. Set the redirect URI under the Authentication tab to `https://yourworker.yourusername.workers.dev/aad`
    4. Generate a client secret under the Certificates & Secrets tab and set your secret `AAD_CLIENT_SECRET` to it
2. Discord side:
    1. [Create a Discord OAuth application](https://discord.com/developers/applications)
    2. Under General Information, set the Linked Roles verification URL to `https://yourworker.yourusername.workers.dev/`
    3. From the OAuth2 tab, copy the client ID to your `DISCORD_CLIENT_ID` secret, and the client secret to your `DISCORD_CLIENT_SECRET` secret
    4. Add a redirect URI of `https://yourworker.yourusername.workers.dev/discord` and set the same redirect URI in the `DISCORD_REDIRECT_URI` secret
    5. Assuming you have a Discord server created, copy the ID of that server to the `DISCORD_GUILD_ID` secret
    6. Generate a bot user for your application and copy its bot token to the `DISCORD_BOT_TOKEN` secret
    7. Invite the bot user to your server and allow it to manage nicknames
    8. Run [a script](https://github.com/discord/linked-roles-sample/blob/main/src/register.js) to register your linked roles
    9. Set the `DISCORD_LOG_CHANNEL_ID` to the ID of a channel on your server which will receive authorization logs
3. Cloudflare Workers:
    1. Clone this repository and switch to this directory
    2. Run `npm install` to install all necessary dependencies
    3. Run `wrangler kv:namespace create DISCORD_AAD` and do the required modifications to `wrangler.toml` it tells you to do
    4. Run `npm run deploy` to deploy your application
    5. After your application is deployed, you can move your secrets from `.dev.vars` to the environment variables of your Worker through the Cloudflare dashboard, or by using `wrangler secret put <NAME>`
3. Optional:
    1. Modify `AAD_EMAIL_REGEX` for your AAD
    2. Modify `DISCORD_PLATFORM_NAME` to make sense for your server
4. Testing:
    1. Create a role with your bot's connection set in Links
    2. Select the Linked Roles menu from the server menu
    3. Select your role
    4. Select your application
    5. Go with the flow
    6. You got it!

## Configuration
You can read more about configuring your worker under the [Workers environment variables documentation](https://developers.cloudflare.com/workers/platform/environment-variables/).

### Environment variables
These environment variables are available for configuration from `wrangler.toml`:
- `AAD_EMAIL_REGEX`: Regular expression that emails received from AAD authentication must match to pass
- `DISCORD_PLATFORM_NAME`: "Platform name" shown on user profiles after linking their role

### Secrets
These secrets should be added to a `.dev.vars` file or as secrets through the Cloudflare Workers dashboard:
- `AAD_TENANT_ID`: Tenant ID of the Azure Active Directory you are authenticating your users to
- `AAD_CLIENT_ID`: Client ID of your Azure Active Directory OAuth application
- `AAD_CLIENT_SECRET`: Client secret of your Azure Active Directory OAuth application
- `AAD_DENYLIST`: Comma-separated list of email addresses that should not succeed in linking the role
- `DISCORD_CLIENT_ID`: Client ID of your Discord OAuth application
- `DISCORD_CLIENT_SECRET`: Client secret of your Discord OAuth application
- `DISCORD_REDIRECT_URI`: Redirect URI of your Discord OAuth application
- `DISCORD_GUILD_ID`: ID of the Discord server in which you are implementing role linking with AAD
- `DISCORD_BOT_TOKEN`: Bot token of the bot associated with the OAuth application
- `DISCORD_LOG_CHANNEL_ID`: Channel to log successful authentications in (denylisted users will be logged as well)

## Further reading
- [AAD OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Discord Linked Roles tutorial](https://discord.com/developers/docs/tutorials/configuring-app-metadata-for-linked-roles)
- [Discord Linked Roles sample](https://github.com/discord/linked-roles-sample)
- [Workers KV documentation](https://developers.cloudflare.com/workers/wrangler/workers-kv)
- [Workers KV runtime API documentation](https://developers.cloudflare.com/workers/runtime-apis/kv)
