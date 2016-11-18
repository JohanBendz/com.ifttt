'use strict';

const request = require('request');

module.exports = [
	{
		description: 'authorizationUrl',
		method: 'POST',
		path: '/revokeAuthorization',
		fn: callback => {

			console.log('IFTTT app API: revoking authorization');

			// Reset access tokens
			Homey.manager('settings').unset('ifttt_access_token');
			Homey.manager('settings').unset('ifttt_refresh_token');

			if (callback) return callback(null, true);
		},
	},
	{
		description: 'authorizationUrl',
		method: 'GET',
		path: '/authorizationUrl',
		role: 'owner',
		fn: callback => {

			const homeyCloudID = Homey.manager('settings').get('homeyCloudID');

			// Check if all credentials are present
			if (!Homey.env.CLIENT_ID || !homeyCloudID) return callback('missing_homey_id');

			// Generate OAuth2 callback, this helps to catch the authorization token
			Homey.manager('cloud').generateOAuth2Callback(`https://ifttt.athom.com/oauth2/authorize?response_type=code&client_id=${Homey.env.CLIENT_ID}&homey_cloud_id=${homeyCloudID}&redirect_uri=https://callback.athom.com/oauth2/callback/&state=${randomString(15)}`,

				// Before fetching authorization code
				(err, url) => {
					if (err) console.error(err, 'IFTTT app API: failed to fetch authorization url');
					else console.log('IFTTT app API: fetched authorization url');

					if (callback) return callback(err, url);
				},

				// After fetching authorization code
				(err, code) => {
					if (err) console.error(err, 'IFTTT app API: failed to fetch authorization code');
					else console.log('IFTTT app API: fetched authorization code');

					// Make request to api to fetch access_token
					request.post({
						url: 'https://ifttt.athom.com/oauth2/token',
						form: {
							client_id: Homey.env.CLIENT_ID,
							client_secret: Homey.env.CLIENT_SECRET,
							grant_type: 'authorization_code',
							code: code,
						},
					}, (err, response, body) => {
						if (err || response.statusCode !== 200) return console.error('IFTTT app API: failed to fetch tokens', (err) ? err : response.statusCode);

						console.log('IFTTT app API: fetched access tokens');

						// Trigger realtime event
						Homey.manager('api').realtime('authorized', !!(!err && body));

						// Store tokens in settings
						try {
							Homey.manager('settings').set('ifttt_access_token', JSON.parse(body).access_token);
							Homey.manager('settings').set('ifttt_refresh_token', JSON.parse(body).refresh_token);
						} catch (err) {
							console.error('Error saving tokens:', err);
						}
					});
				}
			);
		},
	},
	{
		description: 'getTriggers',
		method: 'GET',
		path: '/getTriggers',
		fn: callback => {
			console.log('IFTTT app API: incoming /getTriggers returning', Homey.app.registeredTriggers);
			if (callback) return callback(null, Homey.app.registeredTriggers || []);
		},
	},
	{
		description: 'getActions',
		method: 'GET',
		path: '/getActions',
		fn: callback => {
			console.log('IFTTT app API: incoming /getActions returning', Homey.app.registeredActions);
			if (callback) return callback(null, Homey.app.registeredActions || []);
		},
	},
	{
		description: 'letHomeySpeak',
		method: 'POST',
		path: '/actions/letHomeySpeak',
		fn: (callback, args) => {

			console.log('IFTTT app API: incoming /actions/letHomeySpeak');

			// Check for valid input parameters
			if (args && args.body && args.body.text) {

				// Let Homey speak
				Homey.manager('speech-output').say(args.body.text, (err, success) => {
					if (err) console.error(`IFTTT app API: failed to perform speech output ${err}`);
					else console.log(`IFTTT app API: performed speech output: ${success}`);
					if (callback) return callback(err, success);
				});
			} else {
				console.error('Error: no valid body provided with text to speak');
				if (callback) return callback('Error: no valid body provided with text to speak');
			}
		},
	},
	{
		description: 'triggerAFlow',
		method: 'POST',
		path: '/actions/triggerAFlow',
		fn: (callback, args) => {

			console.log('IFTTT app API: incoming /actions/triggerAFlow');

			// Check for valid input parameters
			if (args && args.body && args.body.which_flow) {

				console.log(`IFTTT app API: trigger ifttt_event: ${args.body.which_flow}`);

				// Trigger flow ifttt_event
				Homey.manager('flow').trigger('ifttt_event', {
					var1: args.body.variable_1 || '',
					var2: args.body.variable_2 || '',
					var3: args.body.variable_3 || '',
				}, { flow_id: args.body.which_flow }, (err, success) => {
					if (err) console.error(`IFTTT app API: failed to trigger ifttt_event: ${args.body.which_flow}`, err);
					else console.log(`IFTTT app API: triggered ifttt_event: ${success}`);
					if (callback) return callback(err, success);
				});
			} else if (callback) callback('IFTTT app API: invalid parameters provided by IFTTT');
		},
	},
];

function randomString(length) {
	return Math.round((Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))).toString(36).slice(1);
}