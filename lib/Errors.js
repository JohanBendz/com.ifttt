'use strict';

class SimpleError extends Error {
  constructor(message, data) {
    super(message);
    this.name = this.constructor.name;
    if (data && Object.prototype.hasOwnProperty.call(data, 'statusCode')) {
      this.statusCode = data.statusCode;
    }
  }
}

module.exports.NoAppletRegisteredForEvent = class NoHomeysError extends SimpleError {
  constructor(message, data) {
    super(message || 'There is no Applet registered with IFTTT for this event', { ...data, statusCode: 401 });
    this.name = 'NoAppletRegisteredForEvent';
  }
};