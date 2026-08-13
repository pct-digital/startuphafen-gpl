import { TRPCError } from '@trpc/server';
import { logServerSideError, redactSecrets } from './errors';

describe('redactSecrets (JSON.stringify replacer)', () => {
  const stringify = (v: unknown) => JSON.stringify(v, redactSecrets, 2);

  it('redacts secret-named string fields', () => {
    const out = stringify({
      amt: 'Eiderstedt',
      passphrase: 'secret-pass',
      password: 'hunter2',
    });
    expect(out).not.toContain('secret-pass');
    expect(out).not.toContain('hunter2');
    expect(out).toContain('[redacted]');
    // non-secret fields are preserved
    expect(out).toContain('"amt": "Eiderstedt"');
  });

  it('replaces binary blobs with a size marker instead of dumping bytes', () => {
    const out = stringify({ file: new Uint8Array([1, 2, 3, 4]) });
    expect(out).toContain('[binary 4 bytes]');
    expect(out).not.toContain('"0": 1');
  });

  it('redacts secret fields nested in the object tree', () => {
    const out = stringify({
      auth: { credential: 'abc', apiKey: 'xyz' },
      ok: 1,
    });
    expect(out).not.toContain('abc');
    expect(out).not.toContain('xyz');
    expect(out).toContain('"ok": 1');
  });
});

describe('logServerSideError', () => {
  it('never writes a credential to the log, even on an error path', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      logServerSideError(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Zertifikat oder Passwort ungültig',
        }),
        'mutation',
        'Documents.save',
        {
          amt: 'Eiderstedt',
          file: new Uint8Array([1, 2, 3]),
          passphrase: 'secret-pass',
        },
        { token: { sub: 'admin-user' } }
      );

      const logged = spy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).not.toContain('secret-pass');
      expect(logged).toContain('[redacted]');
      // the .p12 bytes are still kept out of the log, as before
      expect(logged).toContain('[binary 3 bytes]');
    } finally {
      spy.mockRestore();
    }
  });
});
