import { base64ToUint8Array, bytesToBase64 } from '@startuphafen/base64';
import superjson from 'superjson';

superjson.registerCustom<Uint8Array, string>(
  {
    isApplicable: (v): v is Uint8Array => Object.prototype.toString.call(v) === '[object Uint8Array]',
    serialize: (v) => bytesToBase64(v),
    deserialize: (v) => base64ToUint8Array(v),
  },
  'Uint8Array'
);

export { superjson };
