"use strict";
var request = require('request');
var webhookID;
var triggeredEvent;

var self = module.exports = {
	init: function () {

		// On triggered flow
		Homey.manager('flow').on('trigger.ifttt_event', function (callback, args) {

			// Check if event triggerd is equal to event send in flow card
			if (args.event === triggeredEvent) {
				callback(null, true);
			}
			else {
				callback(true, null);
			}
		});

		// Register initial webhook
		if (Homey.manager("settings").get("url") && Homey.manager("settings").get("id") && Homey.manager("settings").get("secret")) {

			// Register webhook
			self.registerWebhook(Homey.manager("settings").get("id"), Homey.manager("settings").get("secret"));

			// Listen for flow triggers
			self.listenForTriggers(Homey.manager("settings").get("key"));
		}

		// Listen for settings change
		var counter = 0;
		Homey.manager('settings').on('set', function () {
			counter++;
			if (counter == 4) {
				// Register new webhook
				self.registerWebhook(Homey.manager("settings").get('id'), Homey.manager("settings").get('secret'));

				// Listen for flow triggers
				self.listenForTriggers(Homey.manager("settings").get('key'));

				// Reset counter
				counter = 0;
			}
		});
	},
	registerWebhook: function (id, secret, callback) {

		// Register webhook
		Homey.manager('cloud').registerWebhook(id, secret, {}, self.incomingWebhook,
			function (err, result) {
				if (err || !result) {

					// Return failure
					if (callback)callback(true, null);
				}
				else {
					// Unregister old webhook
					if (webhookID && webhookID !== id) Homey.manager('cloud').unregisterWebhook(webhookID);

					// Return success
					if (callback)callback(null, true);
				}
			});

		// Store used webhook internally
		webhookID = id;
	},
	incomingWebhook: function (args) {

		// Store triggered event
		triggeredEvent = args.body.event;

		// Trigger event
		Homey.manager('flow').trigger('ifttt_event');
	},
	listenForTriggers: function (key) {

		// On triggered flow
		Homey.manager('flow').on('action.trigger_ifttt', function (callback, args) {
			var url = 'https://maker.ifttt.com/trigger/' + args.event + '/with/key/' + key;
			request.post(
				url,
				{},
				function (error, response, body) {
					if (!error && response.statusCode == 200) {
						callback(null, true); // we've fired successfully
					}
				}
			);
		});
	}
};