import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { KeycloakRealmMergeHelper } from './realm-merge';
import { FakeRemoteFileSystem } from '../../../../test/fake-remote-file-system';

describe('KeycloakRealmMergeHelper', () => {
  let fakeFs: FakeRemoteFileSystem;
  let helper: KeycloakRealmMergeHelper;
  let testDir: string;

  // Use a fixed "remote" base path for consistency
  const remoteBaseDir = '/opt/myapp/assets';

  beforeEach(() => {
    testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'keycloak-realm-merge-test-')
    );
    fakeFs = new FakeRemoteFileSystem(testDir);
    helper = new KeycloakRealmMergeHelper(fakeFs);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  function setupJson(relativePath: string, data: object): void {
    fakeFs.setupJson(`${remoteBaseDir}/${relativePath}`, data);
  }

  function setupEnvFile(content: string): void {
    fakeFs.setupFile(`${remoteBaseDir}/.env`, content);
  }

  function readOutput(): object {
    return fakeFs.readWrittenJson(
      `${remoteBaseDir}/keycloak/import/realm.json`
    );
  }

  describe('merge', () => {
    it('should throw if DEPLOY_ENVIRONMENT is not set', () => {
      const env = { APP_KEYCLOAK_SECRETS: '{}' };

      expect(() => helper.merge(env, remoteBaseDir)).toThrow(
        'DEPLOY_ENVIRONMENT is not set'
      );
    });

    it('should throw if APP_KEYCLOAK_SECRETS is not set', () => {
      const env = { DEPLOY_ENVIRONMENT: 'staging' };

      expect(() => helper.merge(env, remoteBaseDir)).toThrow(
        'APP_KEYCLOAK_SECRETS is not set'
      );
    });

    it('should throw if APP_KEYCLOAK_SECRETS is invalid JSON', () => {
      const env = {
        DEPLOY_ENVIRONMENT: 'staging',
        APP_KEYCLOAK_SECRETS: 'not-json',
      };

      expect(() => helper.merge(env, remoteBaseDir)).toThrow(
        'APP_KEYCLOAK_SECRETS is not valid JSON'
      );
    });

    it('should throw if base realm template is missing', () => {
      const env = {
        DEPLOY_ENVIRONMENT: 'staging',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      expect(() => helper.merge(env, remoteBaseDir)).toThrow(
        'Base realm template not found'
      );
    });

    it('should throw if .env file is missing', () => {
      setupJson('keycloak/templates/realm.json', { realm: 'test' });

      const env = {
        DEPLOY_ENVIRONMENT: 'staging',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      expect(() => helper.merge(env, remoteBaseDir)).toThrow(
        '.env file not found'
      );
    });

    it('should merge base realm with secrets for development environment', () => {
      setupJson('keycloak/templates/realm.json', {
        realm: 'test',
        displayName: 'Test Realm',
      });
      setupEnvFile('');

      const env = {
        DEPLOY_ENVIRONMENT: 'development',
        APP_KEYCLOAK_SECRETS: JSON.stringify({ secret: 'value' }),
      };

      helper.merge(env, remoteBaseDir);

      const output = readOutput();
      expect(output).toEqual({
        realm: 'test',
        displayName: 'Test Realm',
        secret: 'value',
      });
    });

    it('should apply staging overlay for staging environment', () => {
      setupJson('keycloak/templates/realm.json', {
        realm: 'test',
        setting: 'base',
      });
      setupJson('keycloak/templates/staging.json', {
        setting: 'staging',
        stagingOnly: true,
      });
      setupEnvFile('');

      const env = {
        DEPLOY_ENVIRONMENT: 'staging',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      helper.merge(env, remoteBaseDir);

      const output = readOutput();
      expect(output).toEqual({
        realm: 'test',
        setting: 'staging',
        stagingOnly: true,
      });
    });

    it('should apply staging and production overlays for production environment', () => {
      setupJson('keycloak/templates/realm.json', {
        realm: 'test',
        setting: 'base',
      });
      setupJson('keycloak/templates/staging.json', {
        setting: 'staging',
        stagingOnly: true,
      });
      setupJson('keycloak/templates/production.json', {
        setting: 'production',
        productionOnly: true,
      });
      setupEnvFile('');

      const env = {
        DEPLOY_ENVIRONMENT: 'production',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      helper.merge(env, remoteBaseDir);

      const output = readOutput();
      expect(output).toEqual({
        realm: 'test',
        setting: 'production',
        stagingOnly: true,
        productionOnly: true,
      });
    });

    it('should substitute ${{KEY}} placeholders from .env file', () => {
      setupJson('keycloak/templates/realm.json', {
        realm: 'test',
        redirectUri: '${{CADDY_DOMAIN}}/callback',
        adminUrl: 'https://${{CADDY_DOMAIN}}/admin',
      });
      setupEnvFile('CADDY_DOMAIN=example.com\nOTHER_VAR=unused');

      const env = {
        DEPLOY_ENVIRONMENT: 'development',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      helper.merge(env, remoteBaseDir);

      const output = readOutput() as { redirectUri: string; adminUrl: string };
      expect(output.redirectUri).toBe('example.com/callback');
      expect(output.adminUrl).toBe('https://example.com/admin');
    });

    it('should handle .env file with comments and empty lines', () => {
      setupJson('keycloak/templates/realm.json', {
        value: '${{MY_VAR}}',
      });
      setupEnvFile('# This is a comment\n\nMY_VAR=hello\n\n# Another comment');

      const env = {
        DEPLOY_ENVIRONMENT: 'development',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      helper.merge(env, remoteBaseDir);

      const output = readOutput() as { value: string };
      expect(output.value).toBe('hello');
    });

    it('should create output directory if it does not exist', () => {
      setupJson('keycloak/templates/realm.json', { realm: 'test' });
      setupEnvFile('');

      const env = {
        DEPLOY_ENVIRONMENT: 'development',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      // Ensure import directory doesn't exist
      const importDir = `${remoteBaseDir}/keycloak/import`;
      expect(fakeFs.pathExists(importDir)).toBe(false);

      helper.merge(env, remoteBaseDir);

      expect(fakeFs.pathExists(importDir)).toBe(true);
      expect(fakeFs.pathExists(`${importDir}/realm.json`)).toBe(true);
    });

    it('should respect custom path overrides', () => {
      setupJson('custom/templates/base.json', { realm: 'custom' });
      fakeFs.setupFile(`${remoteBaseDir}/docker.env`, 'VAR=value');

      const env = {
        DEPLOY_ENVIRONMENT: 'development',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      helper.merge(env, remoteBaseDir, {
        base: 'custom/templates/base.json',
        output: 'custom/output/realm.json',
        envFile: 'docker.env',
      });

      const output = fakeFs.readWrittenJson(
        `${remoteBaseDir}/custom/output/realm.json`
      );
      expect((output as { realm: string }).realm).toBe('custom');
    });

    it('should skip missing overlay files without error', () => {
      setupJson('keycloak/templates/realm.json', { realm: 'test' });
      // Don't create staging.json or production.json
      setupEnvFile('');

      const env = {
        DEPLOY_ENVIRONMENT: 'production',
        APP_KEYCLOAK_SECRETS: '{}',
      };

      // Should not throw
      helper.merge(env, remoteBaseDir);

      const output = readOutput();
      expect(output).toEqual({ realm: 'test' });
    });

    it('should deep merge nested objects', () => {
      setupJson('keycloak/templates/realm.json', {
        realm: 'test',
        clients: [{ id: 'client1', name: 'Client 1', secret: 'base-secret' }],
      });
      setupEnvFile('');

      const env = {
        DEPLOY_ENVIRONMENT: 'development',
        APP_KEYCLOAK_SECRETS: JSON.stringify({
          clients: [{ id: 'client1', secret: 'real-secret' }],
        }),
      };

      helper.merge(env, remoteBaseDir);

      const output = readOutput() as {
        clients: Array<{ id: string; name: string; secret: string }>;
      };
      expect(output.clients).toHaveLength(1);
      expect(output.clients[0].id).toBe('client1');
      expect(output.clients[0].name).toBe('Client 1');
      expect(output.clients[0].secret).toBe('real-secret');
    });
  });
});
