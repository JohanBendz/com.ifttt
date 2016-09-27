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
			Homey.manager('settings').set('ifttt_access_token', false);
			Homey.manager('settings').set('ifttt_refresh_token', false);

			return callback(null, true);
		}
	},
	{
		description: 'authorizationUrl',
		method: 'GET',
		path: '/authorizationUrl',
		fn: callback => {

			const homeyCloudID = Homey.manager('settings').get('homeyCloudID');
			console.log('homey cloud id: ', homeyCloudID);
			// Generate OAuth2 callback, this helps to catch the authorization token
			Homey.manager('cloud').generateOAuth2Callback(`https://ifttt.athom.com/oauth2/authorize?response_type=code&client_id=${Homey.env.CLIENT_ID}&homey_cloud_id=${homeyCloudID}&redirect_uri=https://callback.athom.com/oauth2/callback/`,

				// Before fetching authorization code
				(err, url) => {
					if (err) console.error(err, 'IFTTT app API: failed to fetch authorization url');
					else console.log('IFTTT app API: fetched authorization url');

					return callback(err, url);
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
							code: code
						}
					}, (err, response, body) => {
						if (err) return console.error(err, 'IFTTT app API: failed to fetch tokens');

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
		}
	},
	{
		description: 'getTriggers',
		method: 'GET',
		path: '/getTriggers',
		fn: callback => {
			console.log('IFTTT app API: incoming /getTriggers returning', Homey.app.registeredTriggers);
			return callback(null, Homey.app.registeredTriggers || []);
		}
	},
	{
		description: 'getActions',
		method: 'GET',
		path: '/getActions',
		fn: callback => {
			console.log('IFTTT app API: incoming /getActions returning', Homey.app.registeredActions);
			return callback(null, Homey.app.registeredActions || []);
		}
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
					console.log(`IFTTT app API: performed speech output: ${success}`);
					return callback(err, success);
				});
			}
		}
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

				// Let Homey speak
				Homey.manager('flow').trigger('ifttt_event', {
					var1: args.body.variable_1 || '',
					var2: args.body.variable_2 || '',
					var3: args.body.variable_3 || ''
				}, { flow_id: args.body.which_flow }, (err, success) => {
					if (err) console.error(err, `IFTTT app API: failed to trigger ifttt_event: ${args.body.which_flow}`);
					else console.log(`IFTTT app API: triggered ifttt_event: ${success}`);
					return callback(err, success);
				});
			} else if (callback) callback(true, false);
		}
	}
];
