import { superjson } from './';

describe('superjson with Uint8Array support', () => {
  it('encoded an object with a piece of binary data in it', () => {
    const data = {
      x: 'string',
      y: 42,
      z: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    };

    const enc = superjson.stringify(data);
    const parsed = superjson.parse(enc);

    expect(parsed).toEqual(data);
  });
});
