import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Knex, knex } from 'knex';
export class DockerizedPostgres {
  private _knex: Knex | null = null;
  private container?: StartedPostgreSqlContainer;

  constructor() {}
  async start() {
    this.container = await new PostgreSqlContainer(
      'postgres:15.5-bookworm'
    ).start();
  }

  getKnexConfig() {
    if (!this.container) {
      throw Error(
        'No container. Did you try to access postgres.knex before calling start? Make sure to start the container beforehand and dont use global variables in tests!'
      );
    }
    return {
      client: 'pg',
      connection: {
        host: this.container.getHost(),
        port: this.container.getPort(),
        user: this.container.getUsername(),
        database: this.container.getDatabase(),
        password: this.container.getPassword(),
      },
    };
  }
  async stop() {
    await this._knex?.destroy();
    await this.container?.stop();
  }

  async clearDatabase() {
    const config = this.getKnexConfig();
    const kx = knex(config);
    try {
      await kx.transaction(async (trx) => {
        // https://stackoverflow.com/a/21247009
        await trx.raw('DROP SCHEMA public CASCADE');
        await trx.raw('CREATE SCHEMA public');
        await trx.raw('GRANT ALL ON SCHEMA public TO public;');
        await trx.raw("COMMENT ON SCHEMA public IS 'standard public schema';");
      });
    } finally {
      await kx.destroy();
    }
  }
  get knex() {
    if (this._knex == null) {
      this._knex = knex(this.getKnexConfig());
    }
    return this._knex;
  }
}
