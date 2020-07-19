# etfnews
Polls the [School of Electrical Engineering](https://etf.bg.ac.rs/) at the [University of Belgrade](http://bg.ac.rs/)'s web pages to scan for meaningful changes to their content and relays these changes to [Discord](https://discord.com/) via webhooks.

## Setup
The following instructions assume you are in 

Install required packages every time etfnews is downloaded or updated with:
```console
$ npm install
```
Run the etfnews service with:
```console
$ npm start
```
Reload the etfnews configuration with:
```console
$ npm run reload
```

## Configuration
Sample configuration is provided in the `config.sample.json` file. Before running etfnews, please make sure you renamed that file to `config.json` or created a new file with that name.
