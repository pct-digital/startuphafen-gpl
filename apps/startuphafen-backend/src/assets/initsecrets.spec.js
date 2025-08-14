jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn(),
}));

describe('init secrets file', () => {
  let fs;
  let loadEnvFileOrEmpty;
  beforeEach(() => {
    process.argv = [
      'node',
      'initsecrets.js',
      'backend=x',
      'docker=y',
      'keycloak=z',
      'config=w',
    ];
    jest.isolateModules(() => {
      fs = require('fs');
      const initSecrets = require('./initsecrets');
      loadEnvFileOrEmpty = initSecrets.loadEnvFileOrEmpty;
    });
  });
  describe('loadEnvFileOrEmpty', () => {
    it('should parse env file content correctly', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        'POSTGRES_PASSWORD=blablablablab' +
          '\n' +
          'KC_DB_PASSWORD=blublubbububu' +
          '\n' +
          'APP_HOST=domain.de' +
          '\n' +
          'KC_BOOTSTRAP_ADMIN_USERNAME=someadmin' +
          '\n' +
          'KC_BOOTSTRAP_ADMIN_PASSWORD=mucho-grande-strongo-passwordo' +
          '\n' +
          'OIDC_HOST=somehost' +
          '\n' +
          'OIDC_CLIENT_SECRET=supersecretsecretsecret=' +
          '\n' +
          'OIDC_CLIENT_ID=someClientId' +
          '\n' +
          'OIDC_ALIAS=alias'
      );

      const result = loadEnvFileOrEmpty('/path/to/.env');

      expect(result).toEqual([
        { k: 'POSTGRES_PASSWORD', v: 'blablablablab' },
        { k: 'KC_DB_PASSWORD', v: 'blublubbububu' },
        { k: 'APP_HOST', v: 'domain.de' },
        { k: 'KC_BOOTSTRAP_ADMIN_USERNAME', v: 'someadmin' },
        {
          k: 'KC_BOOTSTRAP_ADMIN_PASSWORD',
          v: 'mucho-grande-strongo-passwordo',
        },
        { k: 'OIDC_HOST', v: 'somehost' },
        { k: 'OIDC_CLIENT_SECRET', v: 'supersecretsecretsecret=' },
        { k: 'OIDC_CLIENT_ID', v: 'someClientId' },
        { k: 'OIDC_ALIAS', v: 'alias' },
      ]);
    });

    it('should return empty array when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = loadEnvFileOrEmpty('/non/existent/path');

      expect(result).toEqual([]);
    });
  });
});
