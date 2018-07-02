'use strict';

const Homey = require('homey');
const Log = require('homey-log').Log;

const request = require('request');

class IFTTTApp extends Homey.App {

	/**
	 * Async App initialization. Handles migration, retrieving Homey's cloud id and registering the FlowCards.
	 * @returns {Promise.<*>}
	 */
	async onInit() {

		this.log(`${Homey.manifest.id} running...`);

		// If needed, migrate to current app
		this.migrateToCurrent();

		// Fetch and store homey cloud id
		let homeyId = Homey.ManagerSettings.get('homeyCloudID');
		if (!homeyId) {
			homeyId = await Homey.ManagerCloud.getHomeyId();
			if (homeyId instanceof Error) return this.error('Error: could not find Homey ID', homeyId);
			Homey.ManagerSettings.set('homeyCloudID', homeyId);
		}
		this.homeyId = homeyId;
		this.baseUrl = 'https://ifttt.athomdev.com';

		// Initialize given flow cards
		this.flowCards = await this.initializeFlowCards({
			action: {
				trigger_ifttt: {
					instance: null,
					registered: new Set(),
				},
				trigger_ifttt_with_data: {
					instance: null,
					registered: new Set(),
				},
			},
			trigger: {
				ifttt_event: {
					instance: null,
					registered: new Set(),
				},
			},
		});
	}

	/**
	 * Method that initializes and registers given FlowCards.
	 * @param {Object} flowCards
	 * @param {Object} flowCards.action - Object with FlowCard ids as key
	 * @param {Homey.FlowCardAction} flowCards.action.<FlowCardId>.instance - Homey.FlowCardAction instance
	 * @param {Set} flowCards.action.<FlowCardId>.registered - Set of all registered flow card actions
	 * @param {Object} flowCards.trigger
	 * @param {Homey.FlowCardTrigger} flowCards.trigger.<FlowCardId>.instance - Homey.FlowCardTrigger instance
	 * @param {Set} flowCards.trigger.<FlowCardId>.registered - Set of all registered flow card triggers
	 * @returns {Object} flowCards - Initialized flowCards object
	 */
	async initializeFlowCards(flowCards) {

		// Loop over all flow cards
		for (let flowCardType in flowCards) {
			for (let flowCardId in flowCards[flowCardType]) {
				let flowCard = null;

				// Create new FlowCard depending on type
				switch (flowCardType) {
					case 'trigger':
						flowCard = new Homey.FlowCardTrigger(flowCardId);
						flowCard.register();
						flowCard.registerRunListener(this.triggerHandler.bind(this));
						break;
					case 'action':
						flowCard = new Homey.FlowCardAction(flowCardId);
						flowCard.register();
						flowCard.registerRunListener(this.actionHandler.bind(this));
						break;
					default:
						throw new Error('invalid_flow_card_type');
				}

				// Store FlowCard instance
				flowCards[flowCardType][flowCardId].instance = flowCard;

				// Bind update event
				flowCard.on('update', () => {
					return this.registerFlowCard.call(this, flowCards[flowCardType][flowCardId]);
				});

				// Register flow cards
				await this.registerFlowCard(flowCards[flowCardType][flowCardId]);
			}
		}

		return flowCards;
	}

	/**
	 * Migrate settings from previous app version to the current one.
	 */
	migrateToCurrent() {

		// Check if there is still some data left from the old IFTTT app
		if (Homey.ManagerSettings.get('url') || Homey.ManagerSettings.get('secret')
			|| Homey.ManagerSettings.get('id') || Homey.ManagerSettings.get('key')) {

			Homey.ManagerSettings.unset('url');
			Homey.ManagerSettings.unset('secret');
			Homey.ManagerSettings.unset('id');
			Homey.ManagerSettings.unset('key');

			this.log('migrated to current, notified user via notification');

			// Push notification to show user changes to IFTTT app
			new Homey.Notification({ excerpt: Homey.__('general.major_update_notification') })
				.register();
		}
	}

	/**
	 * Getter for a Homey.FlowCardTrigger instance.
	 * @param {string} id - Flow card id to retrieve
	 * @returns {Homey.FlowCardTrigger}
	 */
	getTriggerFlowCard(id) {
		return this.flowCards.trigger[id].instance;
	}

	/**
	 * Getter for an array of all registered FlowCards
	 * @param {string} type - Type of registered FlowCards to retrieve
	 * @returns {Array} Unique event names of all registered FlowCards of type
	 */
	getRegisteredFlowCards(type) {
		const result = new Set();
		for (let i in this.flowCards[type]) {
			this.flowCards[type][i].registered.forEach(value => {
				result.add(value);
			});
		}
		return Array.from(result);

	}

	/**
	 * Incoming flow action event, register it with IFTTT as an action trigger.
	 * @param {Object} args
	 * @param {string} args.event - Event name as entered by user in FlowCard argument
	 * @param {string} args.data - Data as entered by user in FlowCard argument
	 * @param {Object} state
	 * @param {Function} callback
	 */
	actionHandler(args = {}, state = {}, callback = () => null) {

		this.log(`actionHandler() -> register event: ${args.event}, data: ${args.data}`);

		// Make a call to register trigger with ifttt.athom.com
		this.registerFlowActionTrigger(args)
			.then(() => callback(null, true))
			.catch(err => {
				this.error('actionHandler() -> error registering flow action trigger, trying to refresh tokens', err);

				// Refresh access tokens
				return this.refreshTokens()
					.then(() => {

						this.log(`actionHandler() -> refreshed access tokens, retry register event: ${args.event}, data: ${args.data}`);

						// Retry registering action trigger
						return this.registerFlowActionTrigger(args);
					})
					.then(() => callback(null, true))
					.catch(err => {
						this.error('actionHandler() -> error registering flow action trigger, abort', err);
						return callback(err);
					});
			})
			.catch(err => {
				this.error('actionHandler() -> error refreshing tokens second time failed', err);
				return callback(err);
			});
	}

	/**
	 * Handle flow trigger parsing, check if events match and are valid.
	 * @param {Object} args
	 * @param {string} args.event - Event name as entered by user in FlowCard argument
	 * @param {Object} state
	 * @param {Function} callback
	 */
	triggerHandler(args = {}, state = {}, callback = () => null) {

		this.log(`triggerHandler() -> args: ${args}, state: ${state}`);

		// Check for valid input
		if (args && args.hasOwnProperty('event')) {

			this.log(`triggerHandler() -> event matched: ${args.event.toLowerCase() === state.flow_id.toLowerCase()}`);

			// Return success true if events match
			return callback(null, (args.event.toLowerCase() === state.flow_id.toLowerCase()));
		}

		this.error('triggerHandler() -> error invalid trigger missing args.event property');

		// Return error callback
		return callback(new Error('error invalid trigger missing args.event property'));
	}

	/**
	 * Method that takes a FlowCard instance and fetches all the registered flow cards and their arguments, which is
	 * stored for later reference.
	 * @param {Homey.FlowCard} flowCard - FlowCard instance to  retrieve registered arguments for
	 * @returns {Promise.<*>}
	 */
	async registerFlowCard({ instance: flowCard, registered: registeredFlowCardSet }) {
		this.log(`registerFlowCard() -> type: ${flowCard.type}, id: ${flowCard.id}`);

		// Clear actions set to prevent piling up
		registeredFlowCardSet.clear();

		const flowCardArgumentValues = await flowCard.getArgumentValues();
		if (flowCardArgumentValues instanceof Error) return this.error(`Error: fetching registered Actions ${flowCardArgumentValues}`);

		// Loop over triggers
		flowCardArgumentValues.forEach(flowCardArgumentValue => {

			// Check if all args are valid and present
			if (flowCardArgumentValue && flowCardArgumentValue.hasOwnProperty('event')) {

				// Register action
				registeredFlowCardSet.add(flowCardArgumentValue.event);
			}
		});

		this.log('registerFlowCard() -> result:', registeredFlowCardSet);
	}

	/**
	 * Makes a call to https://ifttt.athom.com to register a flow action trigger event.
	 * @param args
	 * @returns {Promise}
	 */
	registerFlowActionTrigger(args = {}) {

		this.log(`registerFlowActionTrigger() -> event: ${args.event}, homey id: ${this.homeyId}, data: ${args.data}`);

		return new Promise((resolve, reject) => {
			request.post({
				url: `${this.baseUrl}/ifttt/v1/triggers/register/flow_action_is_triggered`,
				json: {
					flowID: args.event,
					homeyCloudID: this.homeyId,
					data: args.data || '',
				},
				headers: {
					Authorization: `Bearer ${Homey.ManagerSettings.get('ifttt_access_token')}`,
				},
			}, (error, response) => {
				if (!error && response.statusCode === 200) {
					this.log('registerFlowActionTrigger() -> triggered IFTTT realtime api');
					return resolve();
				}
				this.error('registerFlowActionTrigger() -> error could not trigger IFTTT realtime api:', error || response.statusCode !== 200);
				return reject(new Error(`error could not trigger IFTTT realtime api: ${(error) ? error : response.statusCode}`));
			});
		});
	}

	/**
	 * Tries to refresh the stored access and refresh tokens.
	 * @returns {Promise}
	 */
	refreshTokens() {
		this.log('refreshTokens()');

		return new Promise((resolve, reject) => {

			// Check if all parameters are provided
			if (!Homey.ManagerSettings.get('ifttt_refresh_token') || !Homey.env.CLIENT_ID || !Homey.env.CLIENT_SECRET) {
				return reject(new Error('invalid_parameters_provided'));
			}

			// Make request to api to fetch access_token
			request.post({
				url: `${this.baseUrl}/oauth2/token`,
				form: {
					client_id: Homey.env.CLIENT_ID,
					client_secret: Homey.env.CLIENT_SECRET,
					grant_type: 'refresh_token',
					refresh_token: Homey.ManagerSettings.get('ifttt_refresh_token'),
				},
			}, (error, response, body) => {
				if (error || response.statusCode !== 200) {
					this.error(`refreshTokens() -> error fetching new tokens: ${(error) ? error : response.statusCode}`);
					return reject(new Error(`error fetching new tokens: ${(error) ? error : response.statusCode}`));
				}
				if (!error && body) {
					let parsedResult;
					try {
						parsedResult = JSON.parse(body);

						// Store new access tokens
						Homey.ManagerSettings.set('ifttt_access_token', parsedResult.access_token);
						Homey.ManagerSettings.set('ifttt_refresh_token', parsedResult.refresh_token);
						this.log('refreshTokens() -> stored new tokens');
						return resolve();
					} catch (err) {
						this.error(`refreshTokens() -> error parsing JSON response from refresh tokens: ${err}`);
						return reject(new Error(`error parsing JSON response from refresh tokens: ${err}`));
					}
				}
				return reject(new Error('error no body provided with refresh tokens'));
			});
		});
	}
}

module.exports = IFTTTApp;
