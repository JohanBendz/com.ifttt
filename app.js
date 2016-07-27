'use strict';

const request = require('request');

const registeredTriggers = module.exports.registeredTriggers = [];

module.exports.init = () => {

	let homeyCloudID = Homey.manager('settings').get('homeyCloudID');

	// Fetch all registered triggers
	Homey.manager('flow').getTriggerArgs('ifttt_event', (err, triggers) => {
		if (!err && triggers) {

			// Loop over triggers
			triggers.forEach(trigger => {

				// Check if all args are valid and present
				if (trigger && trigger.hasOwnProperty('event') && registeredTriggers.indexOf(trigger.event) === -1) {

					// Register trigger
					registeredTriggers.push(trigger.event);
				}
			});
		}
	});

	// Listen for triggers being added
	Homey.manager('flow').on('trigger.ifttt_event.added', (callback, newArgs) => {

		// Check if all values provided and if trigger is not already registered
		if (newArgs && newArgs.hasOwnProperty('event') && registeredTriggers.indexOf(newArgs.event) === -1) {

			// Register trigger
			registeredTriggers.push(newArgs.event);
		}

		callback(null, true);
	});

	// Listen for triggers being removed
	Homey.manager('flow').on('trigger.ifttt_event.removed', (callback, oldArgs) => {

		// Check if all values provided
		if (oldArgs && oldArgs.hasOwnProperty('event')) {
			const i = registeredTriggers.indexOf(oldArgs.event);

			// Check if trigger is registered
			if (i !== -1) {

				// Remove trigger from list
				registeredTriggers.splice(i, 1);
			}
		}

		callback(null, true);
	});

	// Listen for a setting save
	Homey.manager('settings').on('set', (settingName) => {

		// If value saved is homeyCloudID
		if (settingName === 'homeyCloudID') {

			// Save it internally
			homeyCloudID = Homey.manager('settings').get(settingName);
		}
	});

	// On triggered ifttt_event
	Homey.manager('flow').on('trigger.ifttt_event', (callback, args, state) => {

		console.log('IFTTT: on(trigger.ifttt_event)');

		// Check for valid input
		if (args && args.hasOwnProperty('event')) {

			console.log(`IFTTT: continue with flow ${args.event.toLowerCase() === state.flow_id.toLowerCase()}`);

			// Return success true if events match
			callback(null, (args.event.toLowerCase() === state.flow_id.toLowerCase()));
		} else {

			// Return error callback
			callback(true, false);
		}
	});

	// On action trigger_ifttt
	Homey.manager('flow').on('action.trigger_ifttt', (callback, args) => {

		console.log('IFTTT: on(action.trigger_ifttt)');

		// Make a call to register trigger with ifttt.athom.com
		registerFlowActionTrigger(args, homeyCloudID, err => {
			if (err) {

				console.log('Refresh tokens');

				refreshTokens(() => {

					console.log('Retry...');

					// Retry registering action trigger
					registerFlowActionTrigger(args, homeyCloudID, (err, success) => {
						callback(err, success);
					});
				});
			} else if (callback) {
				callback(null, true);
			}
		});
	});
};

/**
 * Makes a call to ifttt.athom.com to register a
 * flow action trigger event.
 * @param eventName
 * @param homeyCloudID
 * @param callback
 */
function registerFlowActionTrigger(args, homeyCloudID, callback) {

	console.log(`Register flow action trigger, event name: ${args.event}, 
	homey cloud id: ${homeyCloudID}, data: ${args.data}`);

	request.post({
		url: 'https://ifttt.athom.com/ifttt/v1/triggers/register/a_flow_action_is_triggered',
		json: {
			flowID: args.event,
			homeyCloudID: homeyCloudID,
			data: args.data
		},
		headers: {
			Authorization: `Bearer ${Homey.manager('settings').get('ifttt_access_token')}`
		}
	}, (error, response) => {
		if (!error && response.statusCode === 200) {
			console.log('IFTTT: succeeded to trigger Realtime API');
			if (callback) callback(null, true);
		} else {
			console.error(error || response.statusCode !== 200, 'IFTTT: failed to trigger Realtime API');
			if (callback) callback(true, false);
		}
	});
}

/**
 * Tries to refresh the stored access and refresh tokens.
 * @param callback
 */
function refreshTokens(callback) {

	// Make request to api to fetch access_token
	request.post({
		url: 'https://ifttt.athom.com/oauth2/token',
		form: {
			client_id: Homey.env.CLIENT_ID,
			client_secret: Homey.env.CLIENT_SECRET,
			grant_type: 'refresh_token',
			refresh_token: Homey.manager('settings').get('ifttt_refresh_token')
		}
	}, (err, response, body) => {
		if (err) {

			console.error(err, 'Error fetching new tokens');

			if (callback) callback(true, false);
		} else {

			console.log('Stored new tokens');

			if (!err && body) {
				let parsedResult;
				try {
					parsedResult = JSON.parse(body);

					// Store new access tokens
					Homey.manager('settings').set('ifttt_access_token', parsedResult.access_token);
					Homey.manager('settings').set('ifttt_refresh_token', parsedResult.refresh_token);

					if (callback) callback(null, true);
				} catch (err) {
					if (callback) callback(true, false);
				}
			} else if (callback) callback(true, false);
		}
	});
}
