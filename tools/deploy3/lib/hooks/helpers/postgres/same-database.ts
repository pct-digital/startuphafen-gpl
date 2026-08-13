/**
 * Guard against copying a database onto itself.
 *
 * The copy clears the target before dumping the source - if source and target
 * are the same physical database, the data would be destroyed before it can
 * be dumped. Used by prep-copy.ts to reject such configurations early.
 */

import { PostgresConnectionConfig } from './postgres';

/**
 * Normalize a hostname for comparison: DNS names are case-insensitive,
 * so "RDS.example.com" and "rds.example.com" are the same host.
 */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

/**
 * Check whether source and target refer to the same physical database.
 *
 * Identical connection details alone are not sufficient: bare hostnames
 * (Docker Compose service names like "database") only resolve inside each
 * server's own Docker network, so the same name on two different servers
 * means two different databases. Hosts containing a dot (FQDNs like an RDS
 * endpoint, or IPs) resolve globally - the same endpoint is the same
 * database no matter which server connects to it.
 *
 * @param sameServer - Whether source and target are on the same server
 *                     (e.g., DEPLOY_SERVER of both environments is identical)
 */
export function isSamePhysicalDatabase(
  source: PostgresConnectionConfig,
  target: PostgresConnectionConfig,
  sameServer: boolean
): boolean {
  const sourceHost = normalizeHost(source.host);
  const targetHost = normalizeHost(target.host);

  const sameEndpoint =
    sourceHost === targetHost &&
    (source.port ?? 5432) === (target.port ?? 5432) &&
    source.database === target.database;

  if (!sameEndpoint) {
    return false;
  }

  return sameServer || sourceHost.includes('.');
}
