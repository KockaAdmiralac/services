/**
 * index.js
 *
 * This module is imported when `etf` is used as a format's type in
 * etfnews configuration.
 */
import Format from '../index.js';

/**
 * Formats an embed for Discord based JSON data about the news article
 * received from the fetcher.
 * @augments Format
 */
export default class ETFFormat extends Format {
    /**
     * Formats the differences between fetched content into Discord embeds.
     * @param {string} content Newly fetched content
     * @returns {object} Transport-compatible objects
     */
    async format(_, __, ___, content) {
        if (content === '') {
            return;
        }
        const {date, snippet, title, url} = JSON.parse(content);
        return {
            content: '',
            options: {
                embeds: [
                    {
                        color: 0x884541,
                        description: snippet.slice(0, 2000),
                        footer: {
                            icon_url: 'https://www.etf.bg.ac.rs/assets/logo-sr-449e87364798e04e5b9e49e085f8ca26f431ecf6bf7aa458926b23fa1836b640.png',
                            text: 'ETF News'
                        },
                        timestamp: new Date(date).toISOString(),
                        title,
                        url
                    }
                ]
            }
        };
    }
}
