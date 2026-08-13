/**
 * Keycloak Admin User Helper
 *
 * Creates and configures admin users in Keycloak via the REST API.
 * This ensures the admin user is properly set up with non-temporary credentials.
 */

import { logger } from '../../../utils/logger';
import { getAccessToken } from './api-client';

/**
 * Configuration for creating an admin user
 */
export interface EnsureAdminUserConfig {
  /** Keycloak host URL (e.g., http://localhost:8080) */
  host: string;
  /** Username for the new admin */
  username: string;
  /** Password for the new admin */
  password: string;
  /**
   * Credentials of an existing admin to authenticate with.
   * Can be the same as username/password if using bootstrap credentials.
   */
  authUsername: string;
  authPassword: string;
}

interface UserRepresentation {
  id?: string;
  username?: string;
  enabled?: boolean;
}

interface RoleRepresentation {
  id: string;
  name: string;
}

/**
 * Helper for managing Keycloak admin users via REST API.
 * Provided to hooks via context.helpers.keycloak.adminUser
 */
export class KeycloakAdminUserHelper {
  /**
   * Find a user by username in the master realm.
   */
  private async findUser(
    host: string,
    token: string,
    username: string
  ): Promise<UserRepresentation | null> {
    const url = `${host}/admin/realms/master/users?username=${encodeURIComponent(
      username
    )}&exact=true`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to search users: ${response.status} ${response.statusText}`
      );
    }

    const users = (await response.json()) as UserRepresentation[];
    logger.info(
      `findUser('${username}'): API returned ${
        users.length
      } user(s): ${JSON.stringify(
        users.map((u) => ({ id: u.id, username: u.username }))
      )}`
    );
    // Keycloak usernames are case-insensitive, so compare accordingly
    return (
      users.find((u) => u.username?.toLowerCase() === username.toLowerCase()) ??
      null
    );
  }

  /**
   * Create a user in the master realm.
   */
  private async createUser(
    host: string,
    token: string,
    username: string
  ): Promise<string> {
    const url = `${host}/admin/realms/master/users`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        enabled: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Failed to create user: ${response.status} ${response.statusText} - ${text}`
      );
    }

    // Get user ID from Location header
    const location = response.headers.get('Location');
    if (!location) {
      throw new Error('No Location header in create user response');
    }

    const userId = location.split('/').pop();
    if (!userId) {
      throw new Error('Could not extract user ID from Location header');
    }

    return userId;
  }

  /**
   * Set a non-temporary password for a user.
   */
  private async setPassword(
    host: string,
    token: string,
    userId: string,
    password: string
  ): Promise<void> {
    const url = `${host}/admin/realms/master/users/${userId}/reset-password`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'password',
        value: password,
        temporary: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Failed to set password: ${response.status} ${response.statusText} - ${text}`
      );
    }
  }

  /**
   * Get the admin role from the master realm.
   */
  private async getAdminRole(
    host: string,
    token: string
  ): Promise<RoleRepresentation> {
    const url = `${host}/admin/realms/master/roles/admin`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get admin role: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as RoleRepresentation;
  }

  /**
   * Assign a realm-level role to a user.
   */
  private async assignRealmRole(
    host: string,
    token: string,
    userId: string,
    role: RoleRepresentation
  ): Promise<void> {
    const url = `${host}/admin/realms/master/users/${userId}/role-mappings/realm`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Failed to assign role: ${response.status} ${response.statusText} - ${text}`
      );
    }
  }

  /**
   * Check if a user has the admin role.
   */
  private async hasAdminRole(
    host: string,
    token: string,
    userId: string
  ): Promise<boolean> {
    const url = `${host}/admin/realms/master/users/${userId}/role-mappings/realm`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get user roles: ${response.status} ${response.statusText}`
      );
    }

    const roles = (await response.json()) as RoleRepresentation[];
    return roles.some((r) => r.name === 'admin');
  }

  /**
   * Ensure an admin user exists with proper (non-temporary) credentials.
   *
   * This method:
   * 1. Creates the user if it doesn't exist
   * 2. Sets a non-temporary password
   * 3. Assigns the admin role if not already assigned
   *
   * If the user already exists with proper setup, this is a no-op.
   *
   * @param config - Configuration including credentials
   * @returns Object indicating what actions were taken
   *
   * @example
   * await helpers.keycloak.adminUser.ensureAdminUser({
   *   host: serverUrl,
   *   username: 'admin',
   *   password: 'secret',
   *   authUsername: 'bootstrap-admin',  // existing admin to authenticate with
   *   authPassword: 'bootstrap-password',
   * });
   */
  async ensureAdminUser(config: EnsureAdminUserConfig): Promise<{
    created: boolean;
    passwordSet: boolean;
    roleAssigned: boolean;
  }> {
    const { host, username, password, authUsername, authPassword } = config;

    logger.info(`Ensuring admin user '${username}' exists in master realm`);

    // Get access token using existing admin credentials
    const token = await getAccessToken(host, authUsername, authPassword);

    // Check if user exists
    let user = await this.findUser(host, token, username);
    let created = false;
    let roleAssigned = false;

    if (!user) {
      logger.info(`Creating user '${username}'...`);
      const userId = await this.createUser(host, token, username);
      user = { id: userId, username };
      created = true;
    } else {
      logger.info(`User '${username}' already exists (id: ${user.id})`);
    }

    const userId = user.id!;

    // Always set the password to ensure it's non-temporary
    logger.info(`Setting non-temporary password for '${username}'...`);
    await this.setPassword(host, token, userId, password);

    // Check and assign admin role if needed
    const hasRole = await this.hasAdminRole(host, token, userId);
    if (!hasRole) {
      logger.info(`Assigning admin role to '${username}'...`);
      const adminRole = await this.getAdminRole(host, token);
      await this.assignRealmRole(host, token, userId, adminRole);
      roleAssigned = true;
    } else {
      logger.info(`User '${username}' already has admin role`);
    }

    logger.info(`Admin user '${username}' is properly configured`);

    return {
      created,
      passwordSet: true,
      roleAssigned,
    };
  }
}
