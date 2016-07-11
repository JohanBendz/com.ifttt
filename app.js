'use strict';

const request = require('request');

module.exports.init = () => {

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

		// TODO authentication
		request.post({
			url: 'https://ifttt.athom.com/ifttt/v1/triggers/register/a_flow_action_is_triggered',
			json: {
				eventName: args.event
			},
			headers: {
				Authorization: 'Bearer d423b7b4fefc6d3a5a2b49f5f8d0f0396ae0c0e7e4454b36b2' +
				'2daaa3ae2c7698b91ed042ce09cd939e66c6d065c7cc6e'
			}
		}, (error, response, body) => {
			if (!error && response.statusCode === 200) {
				console.log('IFTTT: succeeded to trigger Realtime API');
				callback(null, true);
			} else {
				console.log('IFTTT: failed to trigger Realtime API');
				callback(true, false);
			}
		});
	});
};
