'use strict';

const IFTTTFlowCardAction = require('./IFTTTFlowCardAction');
const IFTTTFlowCardTrigger = require('./IFTTTFlowCardTrigger');

class IFTTTFlowCardManager {
  constructor({ log, error }) {
    this.log = log;
    this.error = error;
    this._flowCardActions = [];
    this._flowCardTriggers = [];
    this.log('initialized');
  }

  /**
   * Method will trigger a FlowCardTrigger.
   * @param {string} id - Flow card id
   * @param {object} tokens - Tokens object
   * @param {object} state - State object
   * @returns {Promise<void>}
   */
  async triggerFlowCard({ id, tokens = {}, state = {} } = {}) {
    const flowCardTriggers = this._flowCardTriggers.filter(flowCardTrigger => (flowCardTrigger.id === id));
    if (flowCardTriggers.length === 0) {
      this.error(`Could not find FlowCardTrigger with id: ${id}`);
      throw new Error('This Flow was not found on Homey');
    } else if (flowCardTriggers.length > 1) {
      this.error('Found more than one FlowCardTrigger');
      throw new Error('Found more than one FlowCardTrigger');
    } else if (flowCardTriggers.length === 1) {
      this.log(`triggerFlowCard({ id: ${id} })`, this._flowCardTriggers);
      await flowCardTriggers[0].trigger(tokens, state);
    } else {
      this.error('Unknown error occurred when triggering FlowCardTrigger');
      throw new Error('Unknown error occurred');
    }
  }

  /**
   *
   * @param {Array} ids - Array of Flow Card ids
   * @param {string} [type] - Flow Card type (action/trigger)
   * @returns {Array}
   */
  getRegisteredEvents({ ids = [], type } = {}) {
    let flowCardCollection = null;
    switch (type) {
      case 'trigger':
        flowCardCollection = this._flowCardTriggers;
        break;
      case 'action':
        flowCardCollection = this._flowCardActions;
        break;
      default:
        flowCardCollection = this._flowCardActions.concat(this._flowCardTriggers);
    }

    // this.log(this._flowCardTriggers)
    let result = [];
    for (const i in flowCardCollection) {
      if (ids.length === 0 || ids.includes(flowCardCollection[i].id)) {
        result = result.concat(Array.from(flowCardCollection[i].registeredEvents));
      }
    }

    this.log(`getRegisteredEvents( type: ${type}, ids: ${ids} ) -> success`, result);
    return result;
  }

  /**
   * Factory method that will create a IFTTTFlowCardAction instance.
   * @param {string} id - Flow card id
   * @param {function} runListener - Method that will be set as runListener
   */
  async createFlowCardAction({ id, runListener }) {
    const flowCardAction = new IFTTTFlowCardAction({
      id,
      runListener,
      log: this.log.bind(this, '[IFTTTFlowCardAction]'),
      error: this.error.bind(this, '[IFTTTFlowCardAction]'),
    });
    this._flowCardActions.push(flowCardAction);
    await flowCardAction.getRegisteredEvents();
  }

  /**
   * Factory method that will create a IFTTTFlowCardTrigger instance.
   * @param {string} id - Flow card id
   * @param {function} runListener - Method that will be set as runListener
   */
  async createFlowCardTrigger({ id, runListener }) {
    const flowCardTrigger = new IFTTTFlowCardTrigger({
      id,
      runListener,
      log: this.log.bind(this, '[IFTTTFlowCardTrigger]'),
      error: this.error.bind(this, '[IFTTTFlowCardTrigger]'),
    });
    this._flowCardTriggers.push(flowCardTrigger);
    await flowCardTrigger.getRegisteredEvents();
  }
}

module.exports = IFTTTFlowCardManager;
