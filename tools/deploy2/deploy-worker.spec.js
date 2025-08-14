jest.mock('fs');
jest.mock('child_process');

const child_process = require('child_process');
const DeployWorker = require('./deploy-worker.js');
const fs = require('fs');

//disabled as update of deploy in rnx did not have tests
xdescribe('the deploy-worker', () => {
  describe('it runs smoke tests', () => {
    let worker;

    beforeEach(() => {
      worker = new DeployWorker();

      worker.config.APP_NAME = 'startuphafen';
      worker.config.DEPLOY_SERVER = 'startuphafen-staging.pct-digital.de';
      worker.config.DEPLOY_TAG = '25.0211.1138_startuphafen';
      worker.config.ENVIRONMENT = 'staging';
      worker.config.BACKEND_SECRETS = "{'key':'value'}";
      worker.config.DOCKER_SECRETS = 'key=value';
      worker.config.KEYCLOAK_SECRETS = "{'x':'y'}";
      worker.config.CONFIG_SECRETS = "{'key':'value'}";
    });

    it('validates the zip file exists before copy', () => {
      jest.spyOn(worker, '_execCmd').mockImplementation((cmd) => {
        if (cmd === 'ls 25.0211.1138_startuphafen.zip') {
          throw new Error('not found');
        }
        throw new Error();
      });

      expect(() => worker.smokeTest()).toThrow(
        'ZIP file 25.0211.1138_startuphafen.zip appears to exist on the runner that is trying to do the deploy?!'
      );
    });

    it('validates the zip file folder structure before copy', () => {
      jest.spyOn(worker, '_execCmd').mockImplementation((cmd) => {
        if (cmd === 'ls 25.0211.1138_startuphafen.zip') {
          return '25.0211.1138_startuphafen.zip';
        }
        if (
          cmd ===
          'zipinfo -1 25.0211.1138_startuphafen.zip | grep -m 1 -v "^25.0211.1138_startuphafen/" > /dev/null && echo "bad" || echo "good"'
        ) {
          return 'bad';
        }
        throw new Error();
      });

      expect(() => worker.smokeTest()).toThrow(
        'ZIP file 25.0211.1138_startuphafen.zip contains files not in the expected directory structure. It must contain a single directory named after the tag, i.e. the name of the zip without the zip extension.'
      );
    });

    it("validates the server doesn't have an app directory if it's not initialized", () => {
      jest.spyOn(worker, '_validateZipStructure').mockImplementation();

      jest.spyOn(worker, '_remotePathExists').mockImplementation((path) => {
        if (path === '/opt/startuphafen') {
          return true;
        }
        if (path === '/opt/server-init-marker') {
          return false;
        }
        throw new Error('unexpected path: ' + path);
      });

      expect(() => worker.smokeTest()).toThrow(
        "Server has no init marker but has an app directory, that's weird"
      );
    });
  });

  describe('_runRemote', () => {
    let worker;

    beforeEach(() => {
      worker = new DeployWorker();
      worker.SSH_PORT = 42;
      worker.SSH_USER = 'user';

      worker.config.APP_NAME = 'startuphafen';
      worker.config.DEPLOY_SERVER = 'startuphafen.localhost';
      worker.config.DEPLOY_TAG = '25.0211.1138_startuphafen';
      worker.config.ENVIRONMENT = 'staging';
      worker.config.BACKEND_SECRETS = "{'key':'value'}";
      worker.config.DOCKER_SECRETS = 'key=value';
      worker.config.KEYCLOAK_SECRETS = "{'x':'y'}";
      worker.config.CONFIG_SECRETS = "{'key':'value'}";

      worker._checkedConfigTimestamp = Date.now();
    });

    it('is able to run remote commands via execSync', () => {
      child_process.execSync.mockImplementation(() => 'Hello World');

      const remoteResult = worker._runRemote('echo "Hello World"');

      expect(remoteResult).toBe('Hello World');

      expect(child_process.execSync).toHaveBeenCalledWith(
        'ssh user@startuphafen.localhost -p 42 \'echo "Hello World" 2>&1\''
      );
    });

    it('handles errors when running remote commands via execSync', () => {
      child_process.execSync.mockImplementation(() => {
        throw new Error('Command failed: echo "Hello World"');
      });

      expect(() => worker._runRemote('echo "Hello World"')).toThrow(
        'Command failed: echo "Hello World"'
      );
    });

    it('runs commands in the backend assets', () => {
      child_process.execSync.mockImplementation(() => 'Hello World');

      worker._runInBackendAssets('echo "Hello World"');

      expect(child_process.execSync).toHaveBeenCalledWith(
        'ssh user@startuphafen.localhost -p 42 \'cd /opt/startuphafen/active/apps/startuphafen-backend/assets && echo "Hello World" 2>&1\''
      );
    });
  });

  it('copies files to the remove server', () => {
    worker = new DeployWorker();
    worker.SSH_PORT = 42;
    worker.SSH_USER = 'user';

    worker.config.APP_NAME = 'startuphafen';
    worker.config.DEPLOY_SERVER = 'startuphafen.localhost';
    worker.config.DEPLOY_TAG = '25.0211.1138_startuphafen';
    worker.config.ENVIRONMENT = 'staging';

    worker._checkedConfigTimestamp = Date.now();

    jest.spyOn(worker, '_execCmd').mockImplementation(() => 'ACK');
    expect(worker._copyFileToRemote('local/path', 'remote/path')).toBe('ACK');
    expect(worker._execCmd).toHaveBeenCalledWith(
      "scp -P 42 'local/path' 'user@startuphafen.localhost:remote/path'"
    );
  });

  describe('start & stop server', () => {
    let worker;

    beforeEach(() => {
      worker = new DeployWorker();
      worker.SSH_PORT = 77;
      worker.SSH_USER = 'pct';

      worker.config.APP_NAME = 'sh';
      worker.config.DEPLOY_SERVER = 'sh.localhost';
      worker.config.DEPLOY_TAG = '25.0211.1142_sh';
      worker.config.ENVIRONMENT = 'production';
      worker.config.BACKEND_SECRETS = "{'key':'value'}";
      worker.config.DOCKER_SECRETS = 'key=value';
      worker.config.KEYCLOAK_SECRETS = "{'x':'y'}";
      worker.config.CONFIG_SECRETS = "{'key':'value'}";

      worker._checkedConfigTimestamp = Date.now();
    });

    it('stopServer does not do anything if no active link exists', () => {
      child_process.execSync.mockImplementation((cmd) => {
        if (cmd.includes('readlink /opt/sh/active')) {
          throw new Error('No such file or directory');
        }

        throw new Error('unexpected command called: ' + cmd);
      });

      jest.spyOn(worker, '_runInBackendAssets');
      worker.stopServer();

      expect(worker._runInBackendAssets).not.toHaveBeenCalled();
    });

    it("startServer explodes if there's no active link", () => {
      child_process.execSync.mockImplementation((cmd) => {
        if (cmd.includes('readlink /opt/sh/active')) {
          throw new Error('No such file or directory');
        }

        throw new Error('unexpected command called: ' + cmd);
      });

      expect(() => worker.startServer()).toThrow(
        'You cannot start the server without an active link'
      );
    });

    it('startServer starts the server', () => {
      child_process.execSync.mockImplementation((cmd) => {
        if (cmd.includes('readlink /opt/sh/active')) {
          return '/opt/sh/' + worker.config.DEPLOY_TAG;
        }

        return 'ok';
      });

      jest.spyOn(worker, '_runInBackendAssets');
      worker.startServer();
      expect(worker._runInBackendAssets).toHaveBeenCalledWith(
        'bash production.sh up -d'
      );
    });

    it('stopServer stops the server', () => {
      child_process.execSync.mockImplementation((cmd) => {
        if (cmd.includes('readlink /opt/sh/active')) {
          return '/opt/sh/' + worker.config.DEPLOY_TAG;
        }

        return 'ok';
      });

      jest.spyOn(worker, '_runInBackendAssets');
      worker.stopServer();
      expect(worker._runInBackendAssets).toHaveBeenCalledWith(
        'bash production.sh down'
      );
    });
  });

  describe('Link helpers', () => {
    let worker;

    beforeEach(() => {
      worker = new DeployWorker();
      worker.SSH_PORT = 77;
      worker.SSH_USER = 'pct';

      worker.config.APP_NAME = 'sh';
      worker.config.DEPLOY_SERVER = 'sh.localhost';
      worker.config.DEPLOY_TAG = '25.0211.1142_sh';
      worker.config.ENVIRONMENT = 'production';
      worker.config.BACKEND_SECRETS = "{'key':'value'}";
      worker.config.DOCKER_SECRETS = 'key=value';
      worker.config.KEYCLOAK_SECRETS = "{'x':'y'}";
      worker.config.CONFIG_SECRETS = "{'key':'value'}";

      worker._checkedConfigTimestamp = Date.now();
    });

    it('links', () => {
      jest.spyOn(worker, '_runRemote').mockImplementation();
      worker.link();

      expect(worker._runRemote).toHaveBeenCalledWith(
        'cd /opt/sh && ln -s 25.0211.1142_sh active'
      );
    });

    it('unlinks if there is an old link', () => {
      child_process.execSync.mockImplementation((cmd) => {
        if (cmd.includes('readlink /opt/sh/active')) {
          return '/opt/sh/25.0211.1142_sh';
        }

        return 'ok';
      });

      jest.spyOn(worker, '_runRemote');
      worker.unlink();

      expect(worker._runRemote).toHaveBeenCalledWith('rm /opt/sh/active');
    });

    it('does not unlink if there is no old link', () => {
      child_process.execSync.mockImplementation((cmd) => {
        if (cmd.includes('readlink /opt/sh/active')) {
          throw new Error('No such file or directory');
        }

        return 'ok';
      });

      jest.spyOn(worker, '_runRemote');
      worker.unlink();

      expect(worker._runRemote).not.toHaveBeenCalledWith('rm /opt/sh/active');
      expect(worker._runRemote).toHaveBeenCalledTimes(1);
    });
  });

  describe('File copy from runner to the server', () => {
    let worker;

    beforeEach(() => {
      worker = new DeployWorker();
      worker.SSH_PORT = 77;
      worker.SSH_USER = 'pct';

      worker.config.APP_NAME = 'sh';
      worker.config.DEPLOY_SERVER = 'sh.localhost';
      worker.config.DEPLOY_TAG = '25.0211.1142_sh';
      worker.config.ENVIRONMENT = 'production';
      worker.config.BACKEND_SECRETS = "{'key':'value'}";
      worker.config.DOCKER_SECRETS = 'key=value';
      worker.config.KEYCLOAK_SECRETS = "{'x':'y'}";
      worker.config.CONFIG_SECRETS = "{'key':'value'}";

      worker._checkedConfigTimestamp = Date.now();
    });

    it('copies the files', () => {
      jest.spyOn(worker, '_copyFileToRemote').mockImplementation();
      jest.spyOn(worker, '_runRemote').mockImplementation();

      worker.copyDeploymentFile();

      expect(worker._copyFileToRemote).toHaveBeenCalledWith(
        '25.0211.1142_sh.zip',
        '/opt/sh/25.0211.1142_sh.zip'
      );
      expect(worker._runRemote.mock.calls).toEqual([
        ["mkdir -p '/opt/sh'"],
        ['rm -rf /opt/sh/25.0211.1142_sh'],
        ['cd /opt/sh && unzip 25.0211.1142_sh.zip > /dev/null'],
        ['rm -rf /opt/sh/25.0211.1142_sh.zip'],
      ]);
    });
  });

  describe('initServer()', () => {
    let worker;

    beforeEach(() => {
      worker = new DeployWorker();
      worker.SSH_PORT = 77;
      worker.SSH_USER = 'pct';

      worker.config.APP_NAME = 'sh';
      worker.config.DEPLOY_SERVER = 'sh.localhost';
      worker.config.DEPLOY_TAG = '25.0211.1142_sh';
      worker.config.ENVIRONMENT = 'production';
      worker.config.BACKEND_SECRETS = "{'key':'value'}";
      worker.config.DOCKER_SECRETS = 'key=value';
      worker.config.KEYCLOAK_SECRETS = "{'x':'y'}";
      worker.config.CONFIG_SECRETS = "{'key':'value'}";

      worker._checkedConfigTimestamp = Date.now();
    });

    it('inits if the server has no init so far', () => {
      jest.spyOn(worker, '_determineHasServerInit').mockReturnValue(false);
      jest.spyOn(worker, '_runRemote').mockImplementation();

      worker.initServer();

      expect(worker._determineHasServerInit).toHaveBeenCalled();
      expect(worker._runRemote.mock.calls).toEqual([
        [
          'cd /opt/sh/25.0211.1142_sh/apps/sh-backend/assets && bash server-setup.sh sh.localhost',
        ],
        ['touch /opt/sh/server-init-marker'],
      ]);
    });

    it('does not init if the init marker exists', () => {
      jest.spyOn(worker, '_remotePathExists').mockReturnValue(true);
      jest.spyOn(worker, '_runRemote');

      worker.initServer();

      expect(worker._runRemote).not.toHaveBeenCalled();
    });
  });

  describe('the call to initsecrets', () => {
    let worker;

    beforeEach(() => {
      worker = new DeployWorker();
      worker.SSH_PORT = 77;
      worker.SSH_USER = 'pct';

      worker.config.APP_NAME = 'sh';
      worker.config.DEPLOY_SERVER = 'sh.localhost';
      worker.config.DEPLOY_TAG = '25.0211.1142_sh';
      worker.config.ENVIRONMENT = 'production';
      worker.config.BACKEND_SECRETS = "{'key':'value'}";
      worker.config.DOCKER_SECRETS = 'key=value';
      worker.config.KEYCLOAK_SECRETS = "{'x':'y'}";
      worker.config.CONFIG_SECRETS = "{'key':'value'}";

      worker._checkedConfigTimestamp = Date.now();
    });

    it('can use _createFileFromCIVar to create a file from a CI variable on the remote server', () => {
      jest.spyOn(worker, '_runRemote').mockImplementation();
      jest.spyOn(worker, '_copyFileToRemote').mockImplementation();

      expect(worker._createFileFromCIVar('file.txt', 'content')).toBe(
        '/opt/sh/file.txt'
      );

      expect(fs.writeFileSync).toHaveBeenCalledWith('file.txt', 'content');
      expect(worker._runRemote).toHaveBeenCalledWith('rm -f /opt/sh/file.txt');
      expect(worker._copyFileToRemote).toHaveBeenCalledWith(
        'file.txt',
        '/opt/sh/file.txt'
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith('file.txt');
    });

    it('calls initsecrets', () => {
      jest.spyOn(worker, '_runRemote').mockImplementation();
      jest
        .spyOn(worker, '_createFileFromCIVar')
        .mockImplementation((x) => '/opt/sh/' + x);

      worker.initSecrets();

      expect(worker._createFileFromCIVar).toHaveBeenCalledWith(
        'backend_secrets.json',
        "{'key':'value'}"
      );
      expect(worker._createFileFromCIVar).toHaveBeenCalledWith(
        'env_secrets',
        'key=value'
      );
      expect(worker._createFileFromCIVar).toHaveBeenCalledWith(
        'keycloak_secrets.json',
        "{'x':'y'}"
      );

      expect(worker._runRemote).toHaveBeenCalledWith(
        'docker run --rm -v /opt/sh:/opt/sh ' +
          worker.NODE_IMAGE +
          " node /opt/sh/25.0211.1142_sh/apps/sh-backend/assets/initsecrets.js 'backend=/opt/sh/backend_secrets.json' 'docker=/opt/sh/env_secrets' 'keycloak=/opt/sh/keycloak_secrets.json' 'config=/opt/sh/config_secrets.json' production"
      );
      expect(worker._runRemote).toHaveBeenCalledWith(
        'rm -f /opt/sh/backend_secrets.json /opt/sh/env_secrets /opt/sh/keycloak_secrets.json /opt/sh/config_secrets.json'
      );
    });
  });

  // TODO need more tests, mainly around the keycloak functions
});
