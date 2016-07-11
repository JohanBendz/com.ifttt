'use strict';

module.exports = [
	{
		description: 'letHomeySpeak',
		method: 'POST',
		path: '/actions/letHomeySpeak',
		requires_authorization: false,
		fn: (callback, args) => {

			console.log('IFTTT API: incoming /actions/letHomeySpeak');

			// Check for valid input parameters
			if (args && args.body && args.body.text) {

				// Let Homey speak
				Homey.manager('speech-output').say(args.body.text, (err, success) => {
					console.log(`IFTTT API: performed speech output: ${success}`);
					callback(err, success);
				});
			}
		}
	},
	{
		description: 'triggerAFlow',
		method: 'POST',
		path: '/actions/triggerAFlow',
		requires_authorization: false,
		fn: (callback, args) => {

			console.log('IFTTT API: incoming /actions/triggerAFlow');

			// Check for valid input parameters
			if (args && args.body && args.body.flow_id) {

				// Let Homey speak
				Homey.manager('flow').trigger('ifttt_event', {}, { flow_id: args.body.flow_id }, (err, success) => {
					console.log(`IFTTT API: triggered ifttt_event: ${success}`);
					callback(err, success);
				});
			}
		}
	}
];
