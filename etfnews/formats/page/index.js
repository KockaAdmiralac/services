/**
 * index.js
 *
 * This module is imported when `page` is used as a format's type in
 * etfnews configuration.
 */
import Format from '../index.js';
import {diffLines} from 'diff';
import h2m from 'h2m';
import md5 from 'md5';

/**
 * Formats an embed for Discord based on old and new content of an HTML page.
 * @augments Format
 */
export default class PageFormat extends Format {
    /**
     * Extracts useful content from a page.
     * @param {string} content Content to format
     * @param {URL} url URL of the page
     * @returns {string} Extracted content
     */
    extract(content, url) {
        return h2m(content, {
            // This must be misspelled.
            overides: {
                a: this.linkOverride.bind(this, url)
            }
        })
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join('\n');
    }
    /**
     * Formats the differences between fetched content into Discord embeds.
     * @param {URL} url URL of the page where the content was fetched from
     * @param {string} title Title of the page
     * @param {string} newContent Newly fetched content
     * @param {string} oldContent Previously fetched content
     * @returns {object} Transport-compatible objects
     */
    async format(url, title, newContent, oldContent) {
        const extractedNew = this.extract(newContent, url);
        const extractedOld = this.extract(oldContent, url);
        if (md5(extractedNew) === md5(extractedOld)) {
            return;
        }
        const changes = diffLines(extractedOld, extractedNew)
            .filter(change => change.added || change.removed)
            .map(change => `**${change.added ? 'Dodato' : 'Uklonjeno'}:**\n${change.value.trim()}`)
            .join('\n');
        return {
            content: '',
            options: {
                embeds: [
                    {
                        color: 0x00658F,
                        description: changes.length > 2000 ?
                            'Prevelike izmene, ne može se generisati pregled.' :
                            changes,
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
        };
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
    linkOverride(url, node) {
        if (!node.attrs || !node.attrs.href) {
            return '';
        }
        const href = node.attrs.href;
        if (href.startsWith('http://') || href.startsWith('https://')) {
            return `[${node.md}](${encodeURI(href)})`;
        }
        if (href.startsWith('mailto:')) {
            return node.md;
        }
        if (href.startsWith('/')) {
            return `[${node.md}](${url.origin}${encodeURI(href)})`;
        }
        return `[${node.md}](${url.origin}${
            url.pathname.replace(/\/([^\/]+)$/, '/')
        }${href})`;
    }
}
