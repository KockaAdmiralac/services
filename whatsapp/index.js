/**
 * main.js
 *
 * Main script of the relay.
 */
'use strict';

/**
 * Importing modules.
 */
const fs = require('fs'),
      url = require('url'),
      {WebhookClient} = require('discord.js'),
      FileType = require('file-type'),
      h2m = require('h2m'),
      puppeteer = require('puppeteer'),
      config = require('./config.json');

/**
 * Constants.
 */
// eslint-disable-next-line max-len
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4115.5 Safari/537.36';

/* eslint-disable max-statements */

/**
 * Main class.
 */
class WhatsAppDiscord {
    /**
     * Class constructor.
     */
    constructor() {
        this.avatars = {};
        this.webhook = new WebhookClient(config.id, config.token);
        this.h2mOpts = {
            overides: {
                code: this.codeOverride,
                img: this.imgOverride
            }
        };
        this.userListReads = 50;
        this.userListInterval = null;
    }
    /**
     * Initializes the relay.
     */
    async run() {
        console.info('Starting browser...');
        this.browser = await puppeteer.launch();
        this.page = await this.browser.newPage();
        await this.page.setUserAgent(USER_AGENT);
        await this.page.setViewport({
            height: 1080,
            width: 1920
        });
        console.info('Visiting the site...');
        await this.page.goto('https://web.whatsapp.com');
        await this.page.waitFor(10000);
        console.info('QR Code ready.');
        await this.page.screenshot({path: 'qr.png'});
        await this.page.waitForSelector('.app.two');
        console.info('App has loaded.');
        const handles = await this.page
            .$$('#pane-side > div > div > div > div');
        for (const handle of handles) {
            const groupName = await handle
                .$eval('span[title]', node => node.textContent);
            if (groupName === config.group) {
                await handle.click();
                break;
            }
        }
        await this.scrollToBottom();
        await this.page.waitFor(3000);
        try {
            const ids = await this.page.$$('.message-in > div[data-id]');
            this.lastId = await ids[ids.length - 1]
                .evaluate(node => node.dataset.id);
        } catch (error) {
            console.error('Failed to find last ID:', error);
            this.lastId = null;
        }
        this.lastNumber = null;
        this.lastName = null;
        await this.page.screenshot({path: 'page.png'});
        await this.page.click('#main > header > div[role="button"]');
        try {
            // eslint-disable-next-line max-len
            await this.page.click('#app > div > div > div > div > span > div > span > div > div span[data-icon="down"]');
        } catch (error) {
            // There is no user list to expand.
        }
        this.userListHandle = await this.page
            .$('#app > div > div > div > div > span > div > span > div > div');
        console.info('Intervals set.');
        this.refreshInterval = setInterval(this.safeInterval.bind(this), 3000);
        this.userListInterval = setInterval(
            this.userListScroll.bind(this),
            3000
        );
        await fs.promises.unlink('qr.png');
    }
    /**
     * Checks for new messages and relays them.
     */
    async refresh() {
        await this.scrollToBottom();
        const messageHandles = await this.page.$$('.message-in');
        const unreadHandles = [];
        let newLastId = null;
        for (let i = messageHandles.length - 1; i >= 0; --i) {
            const id = await messageHandles[i]
                .$eval('div[data-id]', node => node.dataset.id);
            if (i === messageHandles.length - 1) {
                newLastId = id;
            }
            if (id === this.lastId) {
                break;
            } else {
                unreadHandles.unshift(messageHandles[i]);
            }
        }
        const messages = [];
        for (const handle of unreadHandles) {
            const message = {};
            // Name
            message.name = await handle.$eval(
                'div > div > div > div > span[dir="auto"]',
                node => node.textContent
            );
            const spl = message.name.split(':');
            if (spl && !isNaN(Number(spl[0])) && !isNaN(Number(spl[1]))) {
                message.name = this.lastName;
            } else {
                this.lastName = message.name;
            }
            try {
                // Phone number
                message.number = await handle.$eval(
                    'div > div > div > div > span[role="button"]',
                    node => node.textContent
                );
                this.lastNumber = message.number;
            } catch (error) {
                message.number = this.lastNumber;
            }
            try {
                // Text
                message.text = h2m(await handle.$eval(
                    'div > div > div > div > div span > span',
                    node => node.innerHTML
                ), this.h2mOpts);
            } catch (error) {
                message.text = '';
            }
            try {
                // Image
                message.image = {};
                message.image.contents = Buffer.from(
                    await handle.$eval(
                        'div > div > div > div > div > img',
                        node => new Promise(async function(resolve, reject) {
                            const response = await fetch(node.src),
                                  data = await response.blob(),
                                  reader = new FileReader();
                            reader.readAsBinaryString(data);
                            reader.addEventListener(
                                'load',
                                () => resolve(reader.result)
                            );
                            reader.addEventListener('error', reject);
                        })
                    ),
                    'binary'
                );
                message.image.type = await FileType
                    .fromBuffer(message.image.contents);
            } catch (error) {
                message.image = null;
            }
            try {
                // File
                message.file = await handle.$eval(
                    'div > div > div > a > div > div > span[dir="auto"]',
                    node => node.textContent
                );
            } catch (error) {
                message.file = null;
            }
            try {
                // eslint-disable-next-line max-len
                const quote = await handle.$$('.message-in > div > div > div > div > div > div > div > div > div > div');
                if (quote && quote.length === 2) {
                    message.quote = {};
                    message.quote.text = h2m(
                        await (
                            await quote[1].getProperty('innerHTML')
                        ).jsonValue(),
                        this.h2mOpts
                    );
                    const spans = await quote[0].$$('span');
                    if (spans && spans.length === 2) {
                        message.quote.number = await (
                            await spans[0].getProperty('textContent')
                        ).jsonValue();
                        message.quote.name = await (
                            await spans[1].getProperty('textContent')
                        ).jsonValue();
                    } else if (spans && spans.length === 1) {
                        message.quote.name = await (
                            await spans[0].getProperty('textContent')
                        ).jsonValue();
                    }
                } else {
                    message.quote = null;
                }
            } catch (error) {
                console.log(error);
                message.quote = null;
            }
            messages.push(message);
        }
        for (const message of messages) {
            const username = this.formatUsername(message.name, message.number),
                  avatarURL = this.avatars[message.number],
                  allowedMentions = {
                      parse: ['roles', 'users']
                  };
            if (message.quote) {
                await this.webhook.send('', {
                    allowedMentions,
                    avatarURL,
                    embeds: [{
                        description: message.quote.text,
                        title: this.formatUsername(
                            message.quote.name,
                            message.quote.number
                        )
                    }],
                    username
                });
            }
            if (message.text) {
                const options = {
                    allowedMentions,
                    avatarURL,
                    username
                };
                if (message.image) {
                    options.files = [{
                        attachment: message.image.contents,
                        name: `attachment.${message.image.type.ext}`
                    }];
                    options.file = message.image.contents;
                }
                await this.webhook.send(message.text, options);
            }
            if (message.file) {
                await this.webhook.send(`*Poslao ${message.file}*.`, {
                    allowedMentions,
                    avatarURL,
                    username
                });
            }
        }
        this.lastId = newLastId;
        await this.page.screenshot({path: 'page.png'});
    }
    /**
     * Scrolls through the user list to grab all avatars.
     */
    async userListScroll() {
        if (--this.userListReads === 0) {
            clearInterval(this.userListInterval);
            this.userListInterval = null;
            console.info('All avatars added.');
            return;
        }
        const members = await this.userListHandle
            .$$('div > div:nth-child(5) > div:nth-child(2) > div > div');
        for (const member of members) {
            const phone = (await member.$eval(
                'span[dir="auto"]',
                node => node.textContent
            )).trim();
            try {
                const avatar = url.parse(await member.$eval(
                    'img',
                    img => img.src
                ), true).query.e;
                if (!this.avatars[phone]) {
                    console.log('Adding avatar for', phone, avatar);
                    this.avatars[phone] = avatar;
                } else if (this.avatars[phone] !== avatar) {
                    console.log(
                        'Updating avatar for',
                        phone,
                        'from',
                        this.avatars[phone],
                        'to',
                        avatar
                    );
                    this.avatars[phone] = avatar;
                }
            } catch (error) {
                // Cannot find avatar.
            }
        }
        await this.userListHandle.evaluate(ul => ul.scrollBy(0, 250));
    }
    /**
     * Executes the refresh interval safely. Only one refresh interval may be
     * executing at a time and it must not throw errors.
     */
    async safeInterval() {
        if (this.intervalExecuting) {
            return;
        }
        this.intervalExecuting = true;
        try {
            await this.refresh();
        } catch (error) {
            console.error('Error in interval:', error);
        }
        this.intervalExecuting = false;
    }
    /**
     * Overrides the <code> tag in the HTML -> Markdown conversion.
     * @param {object} node Node data
     * @returns {string} Markdown-formatted code-block
     */
    codeOverride(node) {
        console.log(node);
        return `\`\`\`${node.md}\`\`\``;
    }
    /**
     * Overrides the <img> tag in the HTML -> Markdown conversion.
     * @param {object} node Node data
     * @returns {string} Markdown-formatted image
     */
    imgOverride(node) {
        if (
            node &&
            node.attrs &&
            (
                node.attrs['data-plain-text'] ||
                node.attrs.alt
            )
        ) {
            return node.attrs['data-plain-text'] || node.attrs.alt;
        }
        return '';
    }
    /**
     * Scrolls the page to the bottom if it wasn't already.
     */
    async scrollToBottom() {
        try {
            await this.page.$eval(
                '#main > div > div > span > div',
                node => node.click()
            );
        } catch (error) {
            // Already scrolled to bottom.
        }
    }
    /**
     * Formats a valid Discord webhook username so that it doesn't exceed 32
     * characters.
     * @param {string} name User's name
     * @param {string} number User's phone number
     * @returns {string} Discord webhook username of valid length
     */
    formatUsername(name, number) {
        if (!name && !number) {
            return 'Nepoznato';
        } else if (!name) {
            if (number.length > 32) {
                return `${number.slice(0, 31)}…`;
            }
            return number;
        } else if (!number) {
            if (name.length > 32) {
                return `${name.slice(0, 31)}…`;
            }
            return name;
        }
        if (name.length > 32) {
            return `${name.slice(0, 31)}…`;
        } else if (name.length + 9 > 32) {
            // Minimum: Name Surname (+381 *)
            return name;
        } else if (name.length + number.length + 3 > 32) {
            const length = 32 - name.length - 4;
            return `${name} (${number.slice(0, length)}…)`;
        }
        return `${name} (${number})`;
    }
    /**
     * Ends the relay.
     */
    async kill() {
        console.log('Closing...');
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.userListInterval !== null) {
            clearInterval(this.userListInterval);
        }
        await this.browser.close();
        this.webhook.destroy();
    }
}

module.exports = WhatsAppDiscord;
