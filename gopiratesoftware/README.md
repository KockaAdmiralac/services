# gopiratesoftware
Simple HTTP server with [Express](https://expressjs.com/) that serves JSON data with general information about whether a current [Twitch](https://twitch.tv) stream.

Built for [Heartbound Wiki](https://heartbound.wiki)'s [Twitch widget](https://heartbound.wiki/wiki/MediaWiki:Twitch.js).

## Setup
- Download this project and open your console in its folder.
- Run `npm install` to install its dependencies.
- Use [Twitch Developers](https://dev.twitch.tv/) to create a Twitch application.
- Once you've created your Twitch application, copy its Client ID.
- Copy `config.sample.json` to `config.json` and change the fields in it:
    - `client` represents your Twitch Client ID.
    - `user` represents the user whose data you're serving.
    - `interval` represents the number of milliseconds on which the channel data is re-fetched.
    - `port` represents the port on which the HTTP server will run.
    - `key` represents the path to the key file used for serving over HTTPS.
    - `cert` represents the path to the certificate file used for serving over HTTPS.
- Run `npm` start to run the server.
