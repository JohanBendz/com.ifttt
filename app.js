"use strict";
var request = require('request');
var webhookID;
var triggeredEvent;

var self = module.exports = {
    init: function () {
        // On triggered flow
        Homey.manager('flow').on('trigger.ifttt_event', function( args, callback ){

            // Check if event triggerd is equal to event send in flow card
            if(args.event === triggeredEvent){
                callback (true);
            } else {
                callback (false);
            }
        });

        // Register initial webhook
        if ( Homey.settings.url && Homey.settings.id && Homey.settings.secret ) {

            // Register webhook
            self.registerWebhook( Homey.settings );

            // Listen for flow triggers
            self.listenForTriggers( Homey.settings );
        }
    },
    updateSettings: function ( settings, callback ) {

        // Register new webhook
        self.registerWebhook( settings, callback );
    },
    registerWebhook: function ( settings, callback ) {

        // Register webhook
        Homey.manager( 'cloud' ).registerWebhook( settings.id, settings.secret, {}, self.incomingWebhook,
            function ( err, result ) {
                if ( err || !result ) {

                    // Return failure
                    if ( callback )callback( null, false );
                }
                else {
                    // Unregister old webhook
                    if ( webhookID && webhookID !== settings.id ) Homey.manager( 'cloud' ).unregisterWebhook( webhookID );

                    // Return success
                    if ( callback )callback( null, true );
                }
            } );

        // Store used webhook internally
        webhookID = settings.id;
    },
    incomingWebhook: function ( args ) {

        // Trigger event
        Homey.manager('flow').trigger('ifttt_event');

        // Store triggered event
        triggeredEvent = args.body.event;
    },
    listenForTriggers: function ( settings ) {

        // On triggered flow
        Homey.manager('flow').on('action.trigger_ifttt', function( args, callback ){
            var url = 'https://maker.ifttt.com/trigger/' + args.event + '/with/key/' + settings.key;
            request.post(
                url,
                {},
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        callback( true ); // we've fired successfully
                    }
                }
            );
        });
    }
};