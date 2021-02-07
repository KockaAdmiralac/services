/**
 * util.js
 *
 * Utility functions around the project.
 */
'use strict';

/**
 * Importing modules.
 */
const {MessageMentions} = require('discord.js');

/**
 * Utility functions around the project.
 */
class Util {
    /**
     * Executes an asynchronous task without throwing an error.
     * @param {Function} task Asynchronous task to execute
     * @param {Function} errorHandler Error handler function
     */
    static async safeAsync(task, errorHandler) {
        try {
            await task();
        } catch (error) {
            await errorHandler(error);
        }
    }
    /**
     * Formats a valid Discord webhook username so that it doesn't exceed 32
     * characters.
     * @param {string} name User's name
     * @param {string} number User's phone number
     * @param {string} callNumber Default call number
     * @param {Student} student Person who sent the message
     * @returns {string} Discord webhook username of valid length
     */
    static formatUsername(name, number, callNumber, student) {
        if (student) {
            return `${student.firstName} ${student.lastName}`.slice(0, 32);
        }
        const normalizedNumber = callNumber && number.startsWith(callNumber) ?
            `0${number.slice(callNumber.length)}` :
            `+${number}`;
        if (!name) {
            if (normalizedNumber.length > 32) {
                return `${normalizedNumber.slice(0, 31)}…`;
            }
            return normalizedNumber;
        }
        if (name.length > 32) {
            return `${name.slice(0, 31)}…`;
        } else if (name.length + 5 > 32) {
            // Minimum: Name Surname (0*)
            return name;
        } else if (name.length + normalizedNumber.length + 3 > 32) {
            const length = 32 - name.length - 4;
            return `${name} (${normalizedNumber.slice(0, length)}…)`;
        }
        return `${name} (${normalizedNumber})`;
    }
    /**
     * Trims a message to fit into the Discord message size limit (2000).
     *
     * The message is trimmed to 1901 characters as message quoting may add
     * a link to the bottom of the quote embed (embed size limit is 2048).
     * @param {string} message Message to trim
     * @returns {string} Trimmed message
     */
    static trimMessage(message) {
        const trimmmed = message.trim();
        if (trimmmed.length < 1900) {
            return trimmmed;
        }
        return `${trimmmed.slice(0, 1900)}…`;
    }
    /**
     * Formats a message for sending to a WhatsApp chat.
     * @param {Message} message Discord message to convert
     * @param {Member} member Discord member who sent the message
     * @param {Array<MessageAttachment>} attachments Discord message attachments
     * @param {object} mentionMap Maps Discord IDs to WhatsApp contacts
     * @returns {string} Formatted message content
     */
    static discordToWhatsApp(message, member, attachments, mentionMap) {
        const BOLD_PLACEHOLDER = '<BOLD_PLACEHOLDER>',
            embedContent = message.embeds
            .map(embed => `\n${embed.title || ''}\n${embed.description || ''}\n${
                embed.fields
                    .map(field => `${field.name}\n${field.value}`)
                    .join('\n')
            }\n${embed.image || ''}`)
            .join(''),
            newContent = `${message.content}${embedContent}`
            // User mentions -> number mentions
            .replace(
                MessageMentions.USERS_PATTERN,
                (_, id) => (mentionMap[id] ?
                    mentionMap[id].map(m => `@${m}`).join(' ') :
                    // TODO: Properly replace mentions in embeds
                    `<@${id}>`)
            )
            // Bold -> placeholder
            .replace(/\*\*(.*?)\*\*/gu, `${BOLD_PLACEHOLDER}$1${BOLD_PLACEHOLDER}`)
            // Italic -> italic
            .replace(/\*(.*?)\*/gu, '_$1_')
            // Placeholder -> bold
            .replace(new RegExp(BOLD_PLACEHOLDER, 'gu'), '*')
            // Underline -> bold (WhatsApp does not support underline)
            .replace(/__(.*?)__/gu, '*$1*')
            // Strikethrough -> strikethrough
            .replace(/~~(.*?)~~/gu, '~$1~')
            // Monospace (single line) -> monospace
            .replace(/(?<!`)`([^`]+)`(?!`)/gu, '```$1```'),
            imageContent = attachments.map(a => a.attachment).join('\n');
        return `*${member.displayName}* _(Discord)_\n${newContent}\n${imageContent}`;
    }
}

module.exports = Util;
