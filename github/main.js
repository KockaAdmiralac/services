#!/usr/bin/env node
/**
 * GitHub-Discord
 * 	A better view at what Wikia is doing through the lense of Discord
 * 
 * This script allows you to poll the repository events for Wikia and then push them through
 * to discord.
 * 
 * Author: Colouratura
 */

const request = require('request');
const fs      = require('fs');

// Configuration
const CONFIG      = require('./config.json');

// Delay
const RUNTIME_DELAY = CONFIG.interval;

// User-Agent
const USER_AGENT = 'khatch (0.0.1) http://dabpenguin.com';

// Wikia/app config
const REPO_ORG   = CONFIG.repo.org;
const REPO_NAME  = CONFIG.repo.repo;
const REPO_ID    = `${REPO_ORG}/${REPO_NAME}`;
const WIKIA_REPO = `https://api.github.com/repos/${REPO_ID}/events`;

// Discord webhook config
const DISCORD_WEBHOOK_ID    = CONFIG.webhook.id;
const DISCORD_WEBHOOK_TOKEN = CONFIG.webhook.token;
const DISCORD_WEBHOOK_COMB  = `${DISCORD_WEBHOOK_ID}/${DISCORD_WEBHOOK_TOKEN}`;
const DISCORD_WEBHOOK_URL   = `https://discord.com/api/webhooks/${DISCORD_WEBHOOK_COMB}`;

// Embed colors
const DISCORD_EMBED_COLORS = {
	merged:   0x6E5494,
	opened:   0x116633,
	reopened: 0x116633,
	closed:   0x991111
};

/**
 * read_last
 * 
 * fetch the last recorded pull event
 *
 * @return {Promise}
 */
const read_last = async function () {
	return new Promise(function (resolve, reject) {
		fs.readFile('cache.json', 'utf-8', function (err, data) {
			if (err)
				resolve({
					id:        0,
					timestamp: new Date(null)
				});

			try {
				let last = JSON.parse(data);
				    last.timestamp = new Date(last.timestamp);

				resolve(last);
			} catch (e) {
				resolve({
					id:        0,
					timestamp: new Date(null)
				});
			}
		});
	});
};

/**
 * save_last
 * 
 * save the last recorded pull event
 *
 * @param {number<int>} id        - id of the last pull event
 * @param {Date}        timestamp - timestamp of the last pull event
 * 
 * @return {Promise}
 */
const save_last = async function (id, timestamp) {
	return new Promise(function (resolve, reject) {
		let data = JSON.stringify({
			id:        id,
			timestamp: timestamp
		});

		fs.writeFile('cache.json', data, 'utf-8', function (err) {
			if (err) reject(err);
			else resolve();
		});
	});
};

/**
 * post_to_channel
 * 
 * Posts a change to the discord channel via webhook
 * 
 * @param {string} p_title  - title of the pull request 
 * @param {string} p_url    - url of the pull request
 * @param {string} p_user   - user name of the person taking the action
 * @param {string} p_action - action being taken
 * 
 * @return {null}
 */
const post_to_channel = function ({title, url, user, action, avatar, user_url, body, timestamp}) {
	let color = DISCORD_EMBED_COLORS[action];
	    title = `[${action.toUpperCase()}] ${title}`;
	
	if (!color) return;

	request.post({
		headers: {
			'User-Agent':   USER_AGENT,
			'Content-Type': 'application/json'
		},
		uri:  DISCORD_WEBHOOK_URL,
		body: {
			embeds: [{
				title:       title,
				url:         url,
				color:       color,
				timestamp:   timestamp.toISOString(),
				description: action === 'opened' ? body : null,
				author: {
					name:     user,
					url:      user_url,
					icon_url: avatar
				}
			}]
		},
		json: true
	}, function (err, res, body) {});
};

/**
 * post_actions
 * 
 * Posts several changes to the discord channel via webhook
 * 
 * @param {array<object>} actions - action objects to post
 * 
 * @return {null}
 */
const post_actions = function (actions) {
	for (let i = 0; i < actions.length; i++) {
		post_to_channel(actions[i]);
	}
};

/**
 * fetch_actions
 * 
 * Fetches a list of recent repo actions
 *
 * @return {Promise}
 */
const fetch_actions = async function () {
	return new Promise(function (resolve, reject) {
		let options = {
			uri: WIKIA_REPO,
			headers: {
				'User-Agent': USER_AGENT
			},
			qs: {
				cb: new Date().getTime()
			},
			json: true
		};

		request.get(options, function (err, res, body) {
			if (err) reject(err);
			if (!body) reject(new Error('No data'));

			resolve(body);
		});
	});
};

/**
 * filter_actions
 * 
 * Only grab the pull request actions
 * 
 * @param {array<object>} actions 
 */
const filter_actions = function (actions) {
	let n_actions = [];

	for (let i = 0; i < actions.length; i++) {
		let action = actions[i];

		if (action.type === 'PullRequestEvent') {
			let actor   = action.actor,
			    payload = action.payload,
			    pr      = payload.pull_request,
			    act     = payload.action;

			if (act === 'closed' && pr.merged_at)
				act = 'merged';
				
			n_actions.push({
				id:        action.id,
				user:      actor.display_login,
				user_url:  actor.html_url,
				avatar:    actor.avatar_url,
				action:    act,
				title:     pr.title,
				url:       pr.html_url,
				body:      pr.body,
				timestamp: new Date(pr.updated_at)
			});
		}
	}

	return n_actions;
};

/**
 * strip_last
 * 
 * strips everything but the newest actions
 * 
 * @param {array<object>}    actions - list of actions to filter 
 * @param {object<key, val>} last    - action to filter by
 * 
 * @return {array<object>}
 */
const strip_last = function (actions, last) {
	let n_actions = [];

	for (let i = 0; i < actions.length; i++) {
		if (actions[i].timestamp > last.timestamp) {
			n_actions.push(Object.assign({}, actions[i]));
		}
	}

	return n_actions;
};

/**
 * main
 * 
 * This is where the entire shebang happens from start to finish
 * 
 * @return {null}
 */
const main = async function () {
	try {
		let last_action = await read_last(),
		    actions     = await fetch_actions();
		    actions     = filter_actions(actions);
		    actions     = strip_last(actions, last_action);

		post_actions(actions);

		if (actions.length > 0)
			save_last(actions[0].id, actions[0].timestamp);
	} catch (e) {
		console.log('An error occurred:', e);
	}
};

/**
 * This anonymous function is actually needed in order to start an
 * async main function.
 * 
 * It also serially executes the main function every N seconds
 */
(async function () {
	main();
	setInterval(main, RUNTIME_DELAY);
}());
