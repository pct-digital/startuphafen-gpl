import { knex, Knex } from 'knex';
import util from 'util';
import {
  DbMigrationConfig,
  DbMigrationFullConfig,
} from './db-migration/entities';
const exec = util.promisify(require('child_process').exec);

export class DbMigrator {
  private knex: Knex;

  private configNode: DbMigrationFullConfig;

  private schemaPath: string;

  private migrationMode: 'push' | 'deploy' | undefined;

  constructor(
    configNodeParam: DbMigrationConfig,
    globalKnex: Knex,
    serverSrcPath: string,
    envType: string,
    migrationMode?: 'push' | 'deploy'
  ) {
    this.configNode = Object.assign(
      {
        migrationsDirectory: serverSrcPath + '/assets/prisma/migrations',
      },
      configNodeParam
    );

    this.knex = knex(globalKnex.client.config);
    const url = `postgres://${globalKnex.client.config.connection.user}:${globalKnex.client.config.connection.password}@${globalKnex.client.config.connection.host}:${globalKnex.client.config.connection.port}/${globalKnex.client.config.connection.database}`;
    process.env['DATABASE_URL'] = url;

    this.schemaPath =
      envType === 'dev'
        ? 'apps/startuphafen-backend/src/assets/prisma/schema.prisma'
        : 'app/assets/prisma/schema.prisma';
    this.migrationMode = migrationMode;
  }

  async migrate() {
    try {
      if (this.configNode.disable) {
        console.log('Database migration is disabled!');
        return;
      } else {
        console.log('Will run prisma database migration!');
      }

      let prismaDeployRes: { stdout: string; stderr: string } | null = null;
      if (this.migrationMode === 'deploy' || this.migrationMode == null) {
        prismaDeployRes = await exec(
          'npx prisma migrate deploy --schema=' + this.schemaPath
        );
      } else if (this.migrationMode === 'push') {
        prismaDeployRes = await exec(
          'npx prisma db push --schema=' + this.schemaPath
        );
      }

      if (prismaDeployRes != null) {
        console.log(prismaDeployRes.stdout);
        if (prismaDeployRes.stderr !== '') {
          console.log(prismaDeployRes.stderr);
        }
      }
    } finally {
      await this.knex.destroy();
    }
  }
}
