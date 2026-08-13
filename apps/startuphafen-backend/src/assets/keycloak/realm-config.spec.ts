import fs from 'fs';
import path from 'path';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${name} must be an object`);
  }

  return value;
}

function getArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }

  return value;
}

function getString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`);
  }

  return value;
}

function loadRealmConfig() {
  const realmPath = path.join(__dirname, 'templates', 'realm.json');
  return JSON.parse(fs.readFileSync(realmPath, 'utf8'));
}

function findObjectByName(values: unknown[], name: string, context: string) {
  const match = values.find((value) => {
    if (!isRecord(value)) {
      return false;
    }

    return value.name === name;
  });

  if (match === undefined) {
    throw new Error(`${context} '${name}' was not found`);
  }

  return getRecord(match, `${context} '${name}'`);
}

function getUserProfileAttributes(realmConfig: unknown) {
  const realm = getRecord(realmConfig, 'realm');
  const components = getRecord(realm.components, 'components');
  const providers = getArray(
    components['org.keycloak.userprofile.UserProfileProvider'],
    'org.keycloak.userprofile.UserProfileProvider'
  );
  const provider = getRecord(providers[0], 'user profile provider');
  const config = getRecord(provider.config, 'user profile provider config');
  const rawUserProfileConfigs = getArray(
    config['kc.user.profile.config'],
    'kc.user.profile.config'
  );
  const rawUserProfileConfig = getString(
    rawUserProfileConfigs[0],
    'kc.user.profile.config[0]'
  );
  const userProfileConfig = getRecord(
    JSON.parse(rawUserProfileConfig),
    'parsed user profile config'
  );

  return getArray(userProfileConfig.attributes, 'user profile attributes');
}

describe('Keycloak realm BundID protections', () => {
  it('forces lastNameBundID to resync on every BundID login', () => {
    const realmConfig = getRecord(loadRealmConfig(), 'realm');
    const identityProviderMappers = getArray(
      realmConfig.identityProviderMappers,
      'identityProviderMappers'
    );
    const lastNameBundIdMapper = findObjectByName(
      identityProviderMappers,
      'lastNameBundID',
      'identity provider mapper'
    );
    const mapperConfig = getRecord(
      lastNameBundIdMapper.config,
      'lastNameBundID.config'
    );

    expect(mapperConfig.syncMode).toBe('FORCE');
    expect(mapperConfig.claim).toBe('family_name');
    expect(mapperConfig['user.attribute']).toBe('lastName');
  });

  it('keeps lastName read-only for end users in the account profile', () => {
    const attributes = getUserProfileAttributes(loadRealmConfig());
    const lastNameAttribute = findObjectByName(
      attributes,
      'lastName',
      'user profile attribute'
    );
    const permissions = getRecord(
      lastNameAttribute.permissions,
      'lastName.permissions'
    );

    expect(getArray(permissions.view, 'lastName.permissions.view')).toEqual([
      'admin',
      'user',
    ]);
    expect(getArray(permissions.edit, 'lastName.permissions.edit')).toEqual([
      'admin',
    ]);
  });
});
