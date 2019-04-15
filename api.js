'use strict';

const Homey = require('homey');

/**
 * Method that acts as a promisified timeout that can be awaited
 * @param {number} ms - Time in milis to wait
 * @returns {Promise<any>}
 */
async function timeout(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve();
    }, ms);
  });
}

module.exports = [
  {
    description: 'getTriggers',
    method: 'GET',
    path: '/getTriggers',
    fn: async (args, callback) => {
      // Hacky fix to prevent a crash when an api call comes in before flowCardManager is initialized in app.js
      if (!Homey.app.flowCardManager) await timeout(500);

      const registeredTriggers = Homey.app.flowCardManager.getRegisteredEvents({
        ids: ['ifttt_event'],
        type: 'trigger',
      });
      Homey.app.log('api/getTriggers ->', registeredTriggers);
      return callback(null, registeredTriggers);
    },
  },
  {
    description: 'getActions',
    method: 'GET',
    path: '/getActions',
    fn: async (args, callback) => {
      // Hacky fix to prevent a crash when an api call comes in before flowCardManager is initialized in app.js
      if (!Homey.app.flowCardManager) await timeout(500);

      const registeredActions = Homey.app.flowCardManager.getRegisteredEvents({
        ids: ['trigger_ifttt', 'trigger_ifttt_with_data'],
        type: 'action',
      });

      Homey.app.log('api/getActions ->', registeredActions);
      return callback(null, registeredActions);
    },
  },
  {
    description: 'startAFlowWithTags',
    method: 'POST',
    path: '/actions/triggerAFlow',
    fn: async (args = {}, callback) => {
      Homey.app.log('api/actions/triggerAFlow');

      // Hacky fix to prevent a crash when an api call comes in before flowCardManager is initialized in app.js
      if (!Homey.app.flowCardManager) await timeout(500);

      // Check for valid input parameters
      if (Object.prototype.hasOwnProperty.call(args, 'body')
        && Object.prototype.hasOwnProperty.call(args.body, 'which_flow')) {
        Homey.app.log(`api/actions/triggerAFlow -> ${args.body.which_flow}`);

        // Check if trigger is registered on Homey upfront
        if (!Homey.app.flowCardManager.getRegisteredEvents({
          ids: ['ifttt_event'],
          type: 'trigger',
        }).includes(args.body.which_flow)) {
          const notFoundError = new Error('No trigger registered on Homey for this which_flow value');
          notFoundError.code = 404;
          return callback(notFoundError);
        }

        // Trigger Flow
        try {
          await Homey.app.flowCardManager.triggerFlowCard({
            id: 'ifttt_event',
            tokens: {
              var1: args.body.variable_1 || '',
              var2: args.body.variable_2 || '',
              var3: args.body.variable_3 || '',
            },
            state: {
              flow_id: args.body.which_flow,
            },
          });
        } catch (err) {
          Homey.app.error(`api/actions/triggerAFlow -> error: failed to trigger ${args.body.which_flow}`, err);
          return callback(err);
        }
        Homey.app.log(`api/actions/triggerAFlow -> triggered ${args.body.which_flow}`);
        return callback(null, true);
      }

      const badRequestError = new Error('Missing which_flow property in body');
      badRequestError.code = 400;
      return callback(badRequestError);
    },
  },
  {
    description: 'tokenExchange',
    method: 'PUT',
    path: '/token',
    fn: (args = {}, callback) => {
      if (Object.prototype.hasOwnProperty.call(args, 'body')
        && Object.prototype.hasOwnProperty.call(args.body, 'token')) {
        Homey.app.token = args.body.token;
        return callback(null, true);
      }
      return callback(new Error('Missing token property in body'));
    },
  },
];
