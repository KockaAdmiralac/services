#!/usr/bin/env node
const {Client} = require('petlja'),
      {WebhookClient} = require('discord.js'),
      config = require('./config.json'),
      {IncomingWebhook} = require('@slack/webhook');

const petlja = new Client(config.petlja);

let lastId = 0,
    discordWebhook = config.discord ?
        new WebhookClient(config.discord.id, config.discord.token) :
        null,
    slackWebhook = config.slack ?
        new IncomingWebhook(config.slack) :
        null;

function wait(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time);
    });
}

function algoraUser(username) {
    return `https://algora.petlja.org/u/${username}`;
}

function authorName(name, username) {
    if (name === username || !name) {
        return username;
    }
    return `${name} [${username}]`;
}

function discord(log) {
    if (!discordWebhook) {
        return;
    }
    const fields = [];
    if (log.target_user) {
        fields.push({
            name: 'Target User',
            value: `[${log.target_user.name}](${algoraUser(log.target_user.username)})`,
            inline: true
        });
    }
    if (log.details) {
        fields.push({
            name: 'Details',
            value: `\`\`\`${log.details}\`\`\``,
            inline: true
        });
    }
    if (log.context) {
        fields.push({
            name: 'Context',
            value: `[URL](https://algora.petlja.org${log.context})`,
            inline: true
        });
    }
    discordWebhook.send('', {
        embeds: [
            {
                author: {
                    name: authorName(log.acting_user.name, log.acting_user.username),
                    icon_url: `https://algora.petlja.org${log.acting_user.avatar_template.replace('{size}', '128')}`,
                    url: algoraUser(log.acting_user.username)
                },
                color: 0x18BC9C,
                fields,
                footer: {
                    icon_url: discordWebhook.avatar,
                    text: 'Petlja Staff Logger'
                },
                timestamp: log.created_at,
                title: log.action_name,
                url: 'https://algora.petlja.org/admin/logs/staff_action_logs'
            }
        ]
    });
}

function slack(log) {
    if (!slackWebhook) {
        return;
    }
    const fields = [];
    if (log.target_user) {
        fields.push({
            title: 'Target User',
            value: `[${log.target_user.name}](${algoraUser(log.target_user.username)})`,
            short: true
        });
    }
    if (log.context) {
        fields.push({
            title: 'Context',
            value: `[URL](https://algora.petlja.org${log.context})`,
            short: true
        });
    }
    slackWebhook.send({
        attachments: [
            {
                fallback: `<${log.acting_user.name}|${algoraUser(log.acting_user.username)}> did <${log.action_name}|https://algora.petlja.org/admin/logs/staff_action_logs>.\n\`\`\`${log.details}\`\`\``,
                color: '#18BC9C',
                author_name: authorName(log.acting_user.name, log.acting_user.username),
                author_link: algoraUser(log.acting_user.username),
                author_icon: `https://algora.petlja.org${log.acting_user.avatar_template.replace('{size}', '128')}`,
                title: log.action_name,
                title_link: 'https://algora.petlja.org/admin/logs/staff_action_logs',
                text: log.details ? `\`\`\`${log.details}\`\`\`` : '',
                fields,
                footer: 'Algora Staff Log',
                ts: new Date(log.created_at).getTime() / 1000
            }
        ]
    });
}

petlja.on('login', async function() {
    while (true) {
        const {staff_action_logs} = await petlja.algora.staffLogs(),
              last = staff_action_logs.filter(l => l.id > lastId);
        for (const log of last) {
            if (discordWebhook) {
                discord(log);
            }
            if (slackWebhook) {
                slack(log);
            }
            if (lastId === 0) {
                break;
            }
        }
        if (last.length) {
            lastId = last[0].id;
        }
        await wait(config.interval);
    }
}).on('error', function(error) {
    console.error('Whoops:', error);
});
