'use strict';

const Homey = require('homey');

class IFTTTFlowCard {
  constructor({
    id, runListener, log, error, type,
  }) {
    this.log = log;
    this.error = error;

    // Create Homey FlowCard instance
    if (type === 'action') {
      this._flowCardInstance = new Homey.FlowCardAction(id);
    } else if (type === 'trigger') {
      this._flowCardInstance = new Homey.FlowCardTrigger(id);
    } else {
      throw new Error('Invalid type in IFTTTFlowCard constructor');
    }

    // Bind update events and register the FlowCard
    this._flowCardInstance.on('update', this.getRegisteredEvents.bind(this));
    this._flowCardInstance.register();
    this._flowCardInstance.registerRunListener(runListener);

    this.registeredEvents = new Set();

    // Handle registering events
    this.log('created', id);
  }

  get id() {
    return this._flowCardInstance.id;
  }

  async getRegisteredEvents() {
    this.registeredEvents.clear();
    // Get all registered events
    let flowCardArgumentValues = [];
    try {
      flowCardArgumentValues = await this._flowCardInstance.getArgumentValues();
    } catch (err) {
      this.error('Error getting argument values', err);
    }

    // Check if all args are valid and present then register action
    for (const flowCardArgumentValue of flowCardArgumentValues) {
      if (flowCardArgumentValue && Object.prototype.hasOwnProperty.call(flowCardArgumentValue, 'event')) {
        this.registeredEvents.add(flowCardArgumentValue.event);
      }
    }

    this.log(`getRegisteredEvents( type: ${this._flowCardInstance.type}, id: ${this.id} ) -> success`, this.registeredEvents);

    return this.registeredEvents;
  }
}

module.exports = IFTTTFlowCard;
