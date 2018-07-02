'use strict';

const Homey = require('homey');

const request = require('request');

module.exports = [
	{
		description: 'authorizationUrl',
		method: 'POST',
		path: '/revokeAuthorization',
		fn: (args = {}, callback = () => null) => {

			Homey.app.log('[IFTTTApi] revoking authorization');

			// Reset access tokens
			Homey.ManagerSettings.unset('ifttt_access_token');
			Homey.ManagerSettings.unset('ifttt_refresh_token');

			return callback(null, true);
		},
	},
	{
		description: 'authorizationUrl',
		method: 'GET',
		path: '/authorizationUrl',
		role: 'owner',
		fn: (args = {}, callback = () => null) => {

			const homeyCloudID = Homey.app.homeyId;

			// Check if all credentials are present
			if (!Homey.env.CLIENT_ID || !homeyCloudID) return callback(new Error('missing_homey_id'));

			// Generate OAuth2 callback, this helps to catch the authorization token
			const myOAuth2Callback = new Homey.CloudOAuth2Callback(`${Homey.app.baseUrl}/oauth2/authorize?response_type=code&client_id=${Homey.env.CLIENT_ID}&homey_cloud_id=${homeyCloudID}&redirect_uri=https://callback.athom.com/oauth2/callback/&state=${randomString(15)}`);
			myOAuth2Callback
				.on('url', url => {
					Homey.app.log('[IFTTTApi] fetched authorization url');
					return callback(null, url);
				})
				.on('code', code => {
					Homey.app.log('[IFTTTApi] fetched authorization code');

					// Make request to api to fetch access_token
					request.post({
						url: `${Homey.app.baseUrl}/oauth2/token`,
						form: {
							client_id: Homey.env.CLIENT_ID,
							client_secret: Homey.env.CLIENT_SECRET,
							grant_type: 'authorization_code',
							code,
						},
					}, (err, response, body) => {
						if (err || response.statusCode !== 200) {
							return Homey.app.error('api -> failed to fetch tokens', err || response.statusCode);
						}

						Homey.app.log('[IFTTTApi] fetched access tokens');

						// Trigger realtime event
						Homey.ManagerApi.realtime('authorized', !!(!err && body));

						// Store tokens in settings
						try {
							Homey.ManagerSettings.set('ifttt_access_token', JSON.parse(body).access_token);
							Homey.ManagerSettings.set('ifttt_refresh_token', JSON.parse(body).refresh_token);
						} catch (err) {
							Homey.app.error('api -> error saving tokens:', err);
						}
					});

				})
				.generate()
				.catch(err => {
					Homey.app.log('[IFTTTApi] error while registering CloudOAuth2Callback', err);
				});

		},
	},
	{
		description: 'getTriggers',
		method: 'GET',
		path: '/getTriggers',
		fn: (args = {}, callback = () => null) => {
			Homey.app.log('[IFTTTApi] incoming /getTriggers returning', Homey.app.getRegisteredFlowCards('trigger'));
			return callback(null, Homey.app.getRegisteredFlowCards('trigger'));
		},
	},
	{
		description: 'getActions',
		method: 'GET',
		path: '/getActions',
		fn: (args = {}, callback = () => null) => {
			Homey.app.log('[IFTTTApi] incoming /getActions returning', Homey.app.getRegisteredFlowCards('action'));
			return callback(null, Homey.app.getRegisteredFlowCards('action'));
		},
	},
	{
		description: 'letHomeySpeak',
		method: 'POST',
		path: '/actions/letHomeySpeak',
		fn: (args = {}, callback = () => null) => {

			Homey.app.log('[IFTTTApi] incoming /actions/letHomeySpeak');

			// Check for valid input parameters
			if (args && args.body && args.body.text) {

				// Let Homey speak
				Homey.ManagerSpeechOutput.say(args.body.text, {})
					.then(() => {
						Homey.app.log(`[IFTTTApi] performed speech output: ${args.body.text}`);
						return callback(null, true);

					})
					.catch(err => {
						Homey.app.error(`api -> failed to perform speech output ${err}`);
						return callback(err);
					});
			} else {
				Homey.app.error('api -> error no valid body provided with text to speak');
				return callback(new Error('error no valid body provided with text to speak'));
			}
		},
	},
	{
		description: 'triggerAFlow',
		method: 'POST',
		path: '/actions/triggerAFlow',
		fn: (args = {}, callback = () => null) => {

			Homey.app.log('[IFTTTApi] incoming /actions/triggerAFlow');

			// Check for valid input parameters
			if (args && args.body && args.body.which_flow) {

				Homey.app.log(`[IFTTTApi] trigger ifttt_event: ${args.body.which_flow}`);
				Homey.app.log(Homey.app.getTriggerFlowCard('ifttt_event'))
				// Trigger flow ifttt_event
				Homey.app.getTriggerFlowCard('ifttt_event').trigger(
					{
						var1: args.body.variable_1 || '',
						var2: args.body.variable_2 || '',
						var3: args.body.variable_3 || '',
					},
					{
						flow_id: args.body.which_flow,
					})
					.then(() => {
						Homey.app.log(`[IFTTTApi] triggered ifttt_event: ${args.body.which_flow}`);
						return callback(null, true);
					})
					.catch(err => {
						Homey.app.error(`api -> failed to trigger ifttt_event: ${args.body.which_flow}`, err);
						return callback(err);
					});
			} else return callback(new Error('invalid parameters provided by IFTTT'));
		},
	},
];

function randomString(length) {
	return Math.round((Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))).toString(36).slice(1);
}
