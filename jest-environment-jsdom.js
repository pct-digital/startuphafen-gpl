// jest vs jsdom vs TextEncoder causes very fun errors such as new Uint8Array is not instanceof Uint8Array unless this workaround is enabled
// https://github.com/paralleldrive/cuid2/issues/44#issuecomment-1538552670

// jest-environment-jsdom.js
'use strict';

const { TextEncoder, TextDecoder } = require('util');
const { default: $JSDOMEnvironment, TestEnvironment } = require('jest-environment-jsdom');

Object.defineProperty(exports, '__esModule', {
  value: true,
});

class JSDOMEnvironment extends $JSDOMEnvironment {
  constructor(...args) {
    const { global } = super(...args);

    // override these unconditionally
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;

    // add this too
    global.Uint8Array = Uint8Array;
  }
}

exports.default = JSDOMEnvironment;
exports.TestEnvironment = TestEnvironment === $JSDOMEnvironment ? JSDOMEnvironment : TestEnvironment;
