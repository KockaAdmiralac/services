/**
 * index.js
 *
 * This module is imported when `directory` is used as a format's type in
 * etfnews configuration.
 */
import Format from '../index.js';
import {diffArrays} from 'diff';

/**
 * Constants.
 */
const DIRECTORY_REGEX = /<img src="\/icons\/[^"]+" alt="\[([^\]]+)\]">(?:<\/td><td>)?\s*<a href="([^"]+)">[^<]+<\/a>(?:<\/td><td align="right">)?\s*(\d+-(?:\w{3}|\d+)-\d+ \d+:\d+)/g;

/**
 * Formats an embed for Discord based on differences in Apache directory
 * listings.
 * @augments Format
 */
export default class DirectoryFormat extends Format {
    /**
     * Formats the differences between fetched content into Discord embeds.
     * @param {URL} url URL of the page where the content was fetched from
     * @param {string} title Title of the page
     * @param {string} newContent Newly fetched content
     * @param {string} oldContent Previously fetched content
     * @returns {object} Transport-compatible objects
     */
    async format(url, title, newContent, oldContent) {
        const oldListing = this._parseApacheListing(oldContent);
        const newListing = this._parseApacheListing(newContent);
        const embeds = [
            ...this._compareLists('files', url, oldListing.files, newListing.files),
            ...this._compareLists('directories', url, oldListing.directories, newListing.directories)
        ];
        if (embeds.length === 0) {
            return;
        }
        return {
            content: '',
            options: {
                embeds: [
                    {
                        color: 0x00658F,
                        description: embeds.join('\n').slice(0, 2000),
                        footer: {
                            icon_url: 'https://pbs.twimg.com/profile_images/3588382817/fc429cf1113d956cee2e85b503b0cfc4.jpeg',
                            text: 'ETF News'
                        },
                        timestamp: new Date().toISOString(),
                        title: `Directory ${title || url.toString()} changed!`,
                        url: url.toString()
                    }
                ]
            }
        };
    }
    /**
     * Parses an Apache directory listing to retrieve files and directories
     * inside it, as well as their modification times.
     * @param {string} content Apache directory listing HTML contents
     * @returns {object} Directories and files in the listing
     * @todo Support newer (tabled) Apache directory listings as well
     */
    _parseApacheListing(content) {
        const listing = {
            directories: {},
            files: {}
        };
        let match;
        do {
            match = DIRECTORY_REGEX.exec(content);
            if (match) {
                if (match[1] === 'DIR') {
                    listing.directories[match[2].slice(0, -1)] = new Date(match[3]);
                } else {
                    listing.files[match[2]] = new Date(match[3]);
                }
            }
        } while (match);
        return listing;
    }
    /**
     * Compares old and new lists of files or directories and creates Discord
     * embed content out of them.
     * @param {string} what Whether files or directories are being compared
     * @param {URL} url URL of the directory listing being parsed
     * @param {object} oldList Old file/directory list
     * @param {object} newList New file/directory list
     * @returns {string} Discord embed content
     */
    _compareLists(what, url, oldList, newList) {
        const oldFilenames = Object.keys(oldList).sort();
        const newFilenames = Object.keys(newList).sort();
        const changeList = diffArrays(oldFilenames, newFilenames);
        const newFiles = changeList
                .filter(change => change.added)
                .flatMap(change => change.value);
        const removedFiles = changeList
                .filter(change => change.removed)
                .flatMap(change => change.value);
        const changedFiles = changeList
                .filter(change => !change.added && !change.removed)
                .flatMap(change => change.value)
                .filter(value => oldList[value].getTime() !== newList[value].getTime());
        const embeds = [];
        if (newFiles.length) {
            embeds.push(this._formatList(`New ${what}`, url, newFiles));
        }
        if (removedFiles.length) {
            embeds.push(this._formatList(`Removed ${what}`, url, removedFiles));
        }
        if (changedFiles.length) {
            embeds.push(this._formatList(`Changed ${what}`, url, changedFiles));
        }
        return embeds;
    }
    /**
     * Formats a list of Markdown links to directory files/directories in
     * the embed,
     * @param {string} what List title
     * @param {URL} url URL to the directory where the files/directories
     *                  are located
     * @param {Array<string>} list List of new/removed/changes filenames
     * @returns {string} List of Markdown links to files/directories
     */
    _formatList(what, url, list) {
        return `**${what}:**\n${
            list
                .map(file => `• [${file}](${url.toString()}/${file})`)
                .join('\n')
        }`;
    }
}
