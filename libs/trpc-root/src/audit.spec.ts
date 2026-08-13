import { resolveAuditActor } from './audit';
import { StandardRequestContext } from './context';

const ctx = (
  partial: Partial<StandardRequestContext>
): StandardRequestContext => ({
  trxFactory: (async () => undefined) as never,
  ...partial,
});

describe('resolveAuditActor', () => {
  it('prefers the user display name when present', () => {
    expect(
      resolveAuditActor(
        ctx({
          user: {
            name: 'Jane Admin',
            firstName: 'Jane',
            lastName: 'Doe',
          } as never,
          token: { sub: 'kc-1', preferred_username: 'jane' } as never,
        })
      )
    ).toBe('Jane Admin');
  });

  it('falls back to first + last name when name is null', () => {
    expect(
      resolveAuditActor(
        ctx({
          user: { name: null, firstName: 'Jane', lastName: 'Doe' } as never,
          token: { sub: 'kc-1' } as never,
        })
      )
    ).toBe('Jane Doe');
  });

  it('falls back to preferred_username for a Keycloak admin with no name claims', () => {
    // The regression case: name is null and firstName/lastName default to ''.
    expect(
      resolveAuditActor(
        ctx({
          user: { name: null, firstName: '', lastName: '' } as never,
          token: { sub: 'kc-1', preferred_username: 'admin-user' } as never,
        })
      )
    ).toBe('admin-user');
  });

  it('falls back to the token sub when nothing else is available', () => {
    expect(
      resolveAuditActor(
        ctx({
          user: { name: null, firstName: '', lastName: '' } as never,
          token: { sub: 'kc-sub-123' } as never,
        })
      )
    ).toBe('kc-sub-123');
  });

  it('never returns a blank/whitespace string', () => {
    const actor = resolveAuditActor(
      ctx({
        user: { name: '  ', firstName: ' ', lastName: ' ' } as never,
        token: { sub: 'kc-sub-123' } as never,
      })
    );
    expect(actor).toBe('kc-sub-123');
  });

  it('returns null when there is no user and no token', () => {
    expect(resolveAuditActor(ctx({}))).toBeNull();
  });
});
