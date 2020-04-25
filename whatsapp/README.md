# whatsapp-discord
Simple WhatsApp -> Discord relay service using WhatsApp Web. This is intended for personal use, but if you find the idea inspiring feel free to use some of the code for a proper production-ready relay.

## Installation
To install all required packages, use:
```console
$ npm install
```

## Configuration
Rename `config.sample.json` to `config.json` and change the following to your needs:
- `id`: Discord webhook ID
- `token`: Discord webhook token
- `group`: Group name of the group you're relaying

## Running
```
$ npm start
```
