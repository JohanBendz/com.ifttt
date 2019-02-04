'use strict';

const Homey = require('homey');
const request = require('request');
const Log = require('homey-log').Log;

const IFTTTFlowCardManager = require('./lib/IFTTTFlowCardManager');
const { NoAppletRegisteredForEvent } = require('./lib/Errors');

class IFTTTApp extends Homey.App {
  async onInit() {
    this.log(`${Homey.manifest.id} running...`);

    // Create IFTTTFlowCardManager instance. important to do this first else api.js has no flowCardManager
    this.flowCardManager = new IFTTTFlowCardManager({
      log: this.log.bind(this, '[IFTTTFlowCardManager]'),
      error: this.error.bind(this, '[IFTTTFlowCardManager]'),
    });

    this.baseUrl = Homey.env.BASE_URL;

    // Fetch and store homey cloud id
    if (!this.homeyId) this.homeyId = await Homey.ManagerCloud.getHomeyId();

    // Send token reset to server, seems this app lost its token
    if (typeof this.token !== 'string') await this.resetToken();

    // Create IFTTTFlowCard instances
    await this.createIFTTTFlowCards();
  }

  get homeyId() {
    return Homey.ManagerSettings.get('homeyCloudID');
  }

  set homeyId(id) {
    return Homey.ManagerSettings.set('homeyCloudID', id);
  }

  get token() {
    return Homey.ManagerSettings.get('athom-cloud-ifttt-token');
  }

  set token(token) {
    return Homey.ManagerSettings.set('athom-cloud-ifttt-token', token);
  }

  /**
   * This method creates the IFTTTFlowCard instances through the IFTTTFlowCardManager.
   */
  async createIFTTTFlowCards() {
    await this.flowCardManager.createFlowCardAction({
      id: 'trigger_ifttt',
      runListener: this.registerFlowHasBeenStarted.bind(this),
    });

    await this.flowCardManager.createFlowCardAction({
      id: 'trigger_ifttt_with_data',
      runListener: this.registerFlowHasBeenStarted.bind(this),
    });

    await this.flowCardManager.createFlowCardTrigger({
      id: 'ifttt_event',
      runListener: (args = {}, state = {}) => ((
        Object.prototype.hasOwnProperty.call(args, 'event')
        && Object.prototype.hasOwnProperty.call(state, 'flow_id')
        && args.event.toLowerCase() === state.flow_id.toLowerCase()
      )),
    });
  }

  /**
   * Method that makes an API call to the IFTTT middleware server to announce that it has lost its token. The IFTTT
   * middleware server will then try to trigger a realtime event with IFTTT that in turn results in a PUT /token on
   * com.ifttt so that the app is authorized again. The IFTTT middleware will respond with a 401 Unauthorized but this
   * is ok.
   * @returns {Promise<*>}
   */
  async resetToken() {
    this.log('resetToken()');
    try {
      await IFTTTApp._asyncPostRequest({
        url: `${this.baseUrl}/homey/reset_token`,
        json: {
          homeyCloudID: this.homeyId,
        },
      });
    } catch (err) {
      if (err.statusCode !== 401 || err.message !== 'Invalid token in body') {
        return this.error('resetToken() -> error:', err);
      }
      return this.log('resetToken() -> success');
    }
  }

  /**
   * Method that is called when a FlowCardAction is executed on Homey, it will make an API call to the IFTTT middlware
   * server to register the event.
   * @param {object} args
   * @param {string} args.event - Event name as entered by the user
   * @param {string} [args.data] - Optional data string
   * @returns {Promise<void>}
   */
  async registerFlowHasBeenStarted(args = {}) {
    this.log(`registerFlowHasBeenStarted(event: ${args.event})`);
    try {
      await IFTTTApp._asyncPostRequest({
        url: `${this.baseUrl}/ifttt/v1/triggers/register/flow_action_is_triggered`,
        json: {
          flowID: args.event,
          homeyCloudID: this.homeyId,
          data: args.data || '',
          token: this.token,
        },
      });
      this.log(`registerFlowHasBeenStarted(event: ${args.event}) -> success`);
    } catch (err) {
      this.error(`registerFlowHasBeenStarted(event: ${args.event}) -> error`, err);
      if (err.statusCode === 401) {
        throw new NoAppletRegisteredForEvent();
      }
      throw err;
    }
    this.log(`registerFlowHasBeenStarted(event: ${args.event}) -> success`);
  }

  /**
   * Utility method that wraps request with a promise and does some basic error handling.
   * @param opts
   * @returns {Promise<any>}
   * @private
   */
  static async _asyncPostRequest(opts) {
    return new Promise((resolve, reject) => {
      request.post(opts, (error, response) => {
        if (!error && response.statusCode === 200) {
          return resolve();
        }
        let err = new Error('Unknown error');
        if (!error && Object.prototype.hasOwnProperty.call(response, 'body')
          && Object.prototype.hasOwnProperty.call(response.body, 'errors')
          && Object.prototype.hasOwnProperty.call(response.body.errors[0], 'message')) {
          err = new Error(response.body.errors[0].message);
        } else if (error) {
          err = new Error(error.message);
        }
        if (response && Object.prototype.hasOwnProperty.call(response, 'statusCode')) {
          err.statusCode = response.statusCode;
        }
        return reject(err);
      });
    });
  }
}

module.exports = IFTTTApp;
