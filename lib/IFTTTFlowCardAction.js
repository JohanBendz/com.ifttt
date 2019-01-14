'use strict';

const IFTTTFlowCard = require('./IFTTTFlowCard');

class IFTTTFlowCardAction extends IFTTTFlowCard {
  constructor(opts) {
    super({ type: 'action', ...opts });
  }
}

module.exports = IFTTTFlowCardAction;
