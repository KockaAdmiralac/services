/**
 * clean.js
 *
 * A modification of the !clear command that, when called without arguments,
 * reads the default "first message" in a channel and clears everything below
 * that message.
 */
const twinklePath = process.argv[2];
const ClearCommand = require(`${twinklePath}/src/plugins/commander/commands/clear.js`);

class CleanCommand extends ClearCommand {
    async call(message, content) {
        let nextMessage = content;
        const firstMessage = this.bot.config.CLEAN.CHANNELS[message.channel.id];
        if (!nextMessage && firstMessage) {
            const nextMessages = await message.channel.messages.fetch({
                after: firstMessage,
                limit: 1
            });
            if (nextMessages.size > 0) {
                nextMessage = nextMessages.first().id;
            }
        }
        return super.call(message, nextMessage);
    }
}

module.exports = CleanCommand;
