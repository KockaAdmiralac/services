/**
 * index.js
 *
 * This module is imported when `page` is used as a format's type in
 * etfnews configuration.
 */
'use strict';

/**
 * Importing modules.
 */
const Format = require('..'),
      {diffLines} = require('diff'),
      h2m = require('h2m'),
      md5 = require('md5');

/**
 * Formats an embed for Discord based on old and new content of an HTML page.
 * @augments Format
 */
class PageFormat extends Format {
    /**
     * Formats the differences between fetched content into Discord embeds.
     * @param {URL} url URL of the page where the content was fetched from
     * @param {string} title Title of the page
     * @param {string} newContent Newly fetched content
     * @param {string} oldContent Previously fetched content
     * @returns {object} Transport-compatible objects
     */
    async format(url, title, newContent, oldContent) {
        if (md5(newContent) === md5(oldContent)) {
            return;
        }
        const changedContent = diffLines(oldContent, newContent)
            .filter(change => change.added || change.removed),
              addedLines = changedContent.filter(change => change.added),
              removedLines = changedContent.filter(change => change.removed),
              addedLineCount = addedLines.length === 0 ?
                0 :
                addedLines.length === 1 ?
                    addedLines[0].count :
                    addedLines.reduce((a, b) => a.count + b.count),
              removedLineCount = removedLines.length === 0 ?
                0 :
                removedLines.length === 1 ?
                    removedLines[0].count :
                    removedLines.reduce((a, b) => a.count + b.count);
        let relay = false;
        if (removedLineCount > 0 || addedLineCount === 1) {
            // Small content addition or removal.
            const diff = changedContent
                .map(change => change.value
                    .trim()
                    .split('\n')
                    .map(line => `${change.added ? '+' : '-'} ${line}`)
                    .join('\n')
                )
                .join('\n')
                .trim();
            if (diff.length) {
                relay = `\`\`\`diff\n${diff}\`\`\``;
            } else {
                console.debug(new Date(), 'But the changes weren\'t there.');
            }
        } else {
            // Medium content addition.
            relay = h2m(
                addedLines
                    .map(change => change.value)
                    .join(' '),
                {
                    // This must be misspelled.
                    overides: {
                        a: this._h2mOverride.bind(this, url)
                    }
                }
            );
        }
        if (typeof relay === 'string') {
            return {
                content: '',
                options: {
                    embeds: [
                        {
                            color: 0x00658F,
                            description: relay.length > 2000 ?
                                'Prevelike izmene, ne može se generisati pregled.' :
                                relay,
                            footer: {
                                icon_url: 'https://pbs.twimg.com/profile_images/3588382817/fc429cf1113d956cee2e85b503b0cfc4.jpeg',
                                text: 'ETF News'
                            },
                            timestamp: new Date().toISOString(),
                            title: `Stranica '${title || url.toString()}' ažurirana!`,
                            url: url.toString()
                        }
                    ]
                }
            }
        }
    }
    /**
     * Overrides h2m's formatting of <a> tags so Discord can accept them as
     * proper links.
     *
     * In particular, page-relative paths must be converted
     * to absolute paths and no protocols other than http: and https: will be
     * accepted.
     * @param {URL} url URL to the page whose changes are being relayed
     * @param {object} node h2m node object to be formatted to Markdown
     * @returns {string} Formatted Markdown for the <a> tag
     */
    _h2mOverride(url, node) {
        if (!node.attrs || !node.attrs.href) {
            return '';
        }
        const href = node.attrs.href;
        if (href.startsWith('http://') || href.startsWith('https://')) {
            return `[${node.md}](${href})`;
        }
        if (href.startsWith('mailto:')) {
            return node.md;
        }
        if (href.startsWith('/')) {
            return `[${node.md}](${url.origin}${href})`;
        }
        return `[${node.md}](${url.origin}${
            url.pathname.replace(/\/([^\/]+)$/, '/')
        }${href})`;
    }
}

module.exports = PageFormat;
