/**
 * index.js
 *
 * Formats ETF directory contents.
 */
'use strict';

/**
 * Importing modules.
 */
const Format = require('..'),
      {diffArrays} = require('diff');

/**
 * Constants.
 */
const DIRECTORY_REGEX = /<img src="\/icons\/[^"]+" alt="\[([^\]]+)\]"> <a href="([^"]+)">[^<]+<\/a>\s*(\d{2}-\w{3}-\d{4} \d{2}:\d{2})/g;

/**
 * Formats ETF directory contents.
 */
class DirectoryFormat extends Format {
    /**
     * Formats a Discord embed.
     */
    async format(url, title, newContent, oldContent) {
        const oldListing = this.parseApacheListing(oldContent),
              newListing = this.parseApacheListing(newContent),
              embeds = [
                ...this.compareLists('files', url, oldListing.files, newListing.files),
                ...this.compareLists('directories', url, oldListing.directories, newListing.directories)
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
     * Parses out files and directories from Apache directory listing.
     */
    parseApacheListing(content) {
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
     * Compares old lists of files/directories
     */
    compareLists(what, url, oldList, newList) {
        const oldFilenames = Object.keys(oldList).sort(),
              newFilenames = Object.keys(newList).sort(),
              changeList = diffArrays(oldFilenames, newFilenames),
              newFiles = changeList
                .filter(change => change.added)
                .flatMap(change => change.value),
              removedFiles = changeList
                .filter(change => change.removed)
                .flatMap(change => change.value),
              changedFiles = changeList
                .filter(change => !change.added && !change.removed)
                .flatMap(change => change.value)
                .filter(value => oldList[value].getTime() !== newList[value].getTime()),
              embeds = [];
        if (newFiles.length) {
            embeds.push(this.formatList(`New ${what}`, url, newFiles));
        }
        if (removedFiles.length) {
            embeds.push(this.formatList(`Removed ${what}`, url, removedFiles));
        }
        if (changedFiles.length) {
            embeds.push(this.formatList(`Changed ${what}`), url, changedFiles);
        }
        return embeds;
    }
    /**
     * Formats a list in the embed,
     */
    formatList(what, url, list) {
        return `**${what}:**\n${
            list
                .map(file => `• [${file}](${url.toString()}/${file})`)
                .join('\n')
        }`;
    }
}

module.exports = DirectoryFormat;
