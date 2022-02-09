# approve-account
Automatically approves accounts with a specified email suffix on [MediaWiki](https://mediawiki.org) websites using the [ConfirmAccount extension](https://mediawiki.org/wiki/Extension:ConfirmAccount). It requests account requests directly from the wiki's database, then logs in to approve those that need approval.

## Setup
Copy `config.sample.json` to `config.json` and fill in the required values. Install modules using:
```console
$ npm install
```
then run the service using:
```console
$ npm install
```
Service currently requires Node.js 17+.
