import { Knex } from 'knex';
import { withClock } from '@startuphafen/utility';
import {
  ProcessContext,
  waitForProcessSuccess,
} from '@startuphafen/utility-server';

export class DbMigrator {
  constructor(
    private knex: Knex,
    private serverSrcPath: string,
    private silent: boolean
  ) {}

  async migrate() {
    const schemaPath = this.serverSrcPath + '/assets/prisma/schema.prisma';

    const work = async () => {
      const DATABASE_URL = `postgres://${this.knex.client.config.connection.user}:${this.knex.client.config.connection.password}@${this.knex.client.config.connection.host}:${this.knex.client.config.connection.port}/${this.knex.client.config.connection.database}`;

      if (!this.silent) {
        console.log('Migration will run on db ' + DATABASE_URL);
        console.log('Migration schema path is ' + schemaPath);
        console.log('Migration working directory is' + process.cwd());
      }

      const procs = new ProcessContext();
      const prismaProc = procs.startProcess(
        'npx',
        ['-y', 'prisma@6.19.1', 'migrate', 'deploy', '--schema=' + schemaPath],
        {
          // there are two possible cases: Either this is a local dev run or it is run inside a docker container
          cwd:
            this.serverSrcPath !== '/home/node/app'
              ? process.cwd()
              : '/home/node/app', // Important or prisma migrate somehow hangs inside the docker container
          env: {
            ...process.env,
            DATABASE_URL,
          },
        },
        true,
        this.silent
      );

      await waitForProcessSuccess(prismaProc);
    };

    if (this.silent) {
      await work();
    } else {
      await withClock(work, 'Prisma DB migration');
    }
  }
}
