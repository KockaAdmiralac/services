/**
 * index.js
 *
 * Formats an embed for Discord based on updated page content.
 */
'use strict';

/**
 * Importing modules.
 */
const Format = require('..'),
      md5 = require('md5'),
      {diffLines} = require('diff'),
      h2m = require('h2m');

/**
 * Formats an embed for Discord based on updated page content.
 */
class PageFormat extends Format {
    /**
     * Formats a Discord embed.
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
                    overides: {
                        a: function(node) {
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
                }
            );
            console.log(relay);
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
}

module.exports = PageFormat;
