'use strict';

const IFTTTFlowCard = require('./IFTTTFlowCard');

class IFTTTFlowCardTrigger extends IFTTTFlowCard {
  constructor(opts) {
    super({ type: 'trigger', ...opts });
  }

  async trigger(tokens, state) {
    return this._flowCardInstance.trigger(tokens, state);
  }
}

module.exports = IFTTTFlowCardTrigger;
