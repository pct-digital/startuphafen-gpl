import { isSamePhysicalDatabase, normalizeHost } from './same-database';
import { PostgresConnectionConfig } from './postgres';

function conn(
  overrides: Partial<PostgresConnectionConfig> = {}
): PostgresConnectionConfig {
  return {
    host: 'rds.example.com',
    port: 5432,
    user: 'app',
    password: 'secret',
    database: 'app',
    ...overrides,
  };
}

describe('normalizeHost', () => {
  it('lowercases hostnames', () => {
    expect(normalizeHost('RDS.Example.COM')).toBe('rds.example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeHost('  rds.example.com ')).toBe('rds.example.com');
  });
});

describe('isSamePhysicalDatabase', () => {
  describe('globally resolvable hosts (FQDNs / IPs)', () => {
    it('detects the same FQDN endpoint as the same database', () => {
      expect(isSamePhysicalDatabase(conn(), conn(), false)).toBe(true);
    });

    it('detects the same endpoint despite different hostname casing', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ host: 'RDS.EXAMPLE.COM' }),
          conn({ host: 'rds.example.com' }),
          false
        )
      ).toBe(true);
    });

    it('detects the same IP endpoint as the same database', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ host: '10.0.0.10' }),
          conn({ host: '10.0.0.10' }),
          false
        )
      ).toBe(true);
    });

    it('treats different databases on the same host as different', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ database: 'app' }),
          conn({ database: 'keycloak' }),
          false
        )
      ).toBe(false);
    });

    it('treats different ports on the same host as different', () => {
      expect(
        isSamePhysicalDatabase(conn({ port: 5432 }), conn({ port: 5433 }), false)
      ).toBe(false);
    });

    it('treats different hosts as different', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ host: 'rds-old.example.com' }),
          conn({ host: 'rds-new.example.com' }),
          false
        )
      ).toBe(false);
    });

    it('defaults a missing port to 5432', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ port: undefined }),
          conn({ port: 5432 }),
          false
        )
      ).toBe(true);
      expect(
        isSamePhysicalDatabase(
          conn({ port: undefined }),
          conn({ port: 5433 }),
          false
        )
      ).toBe(false);
    });
  });

  describe('local hosts (Docker Compose service names)', () => {
    it('treats identical service names on different servers as different databases', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ host: 'database' }),
          conn({ host: 'database' }),
          false
        )
      ).toBe(false);
    });

    it('treats identical service names on the same server as the same database', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ host: 'database' }),
          conn({ host: 'database' }),
          true
        )
      ).toBe(true);
    });

    it('treats different service names on the same server as different', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ host: 'database' }),
          conn({ host: 'keycloak-database' }),
          true
        )
      ).toBe(false);
    });
  });

  describe('same server with external hosts', () => {
    it('detects the same FQDN endpoint on the same server', () => {
      expect(isSamePhysicalDatabase(conn(), conn(), true)).toBe(true);
    });

    it('treats different databases as different even on the same server', () => {
      expect(
        isSamePhysicalDatabase(
          conn({ database: 'app' }),
          conn({ database: 'keycloak' }),
          true
        )
      ).toBe(false);
    });
  });

  it('ignores user and password differences - same endpoint is the same database', () => {
    expect(
      isSamePhysicalDatabase(
        conn({ user: 'app', password: 'a' }),
        conn({ user: 'admin', password: 'b' }),
        false
      )
    ).toBe(true);
  });
});
