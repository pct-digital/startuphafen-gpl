import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { STARTUPHAFENBACKEND_TABLES } from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';
import {
  ProfileInfoDbController,
  ProfileInfoInput,
} from './profile-info-db-controller';

const postgres = new DockerizedPostgres();
const PROFILE_INFO_TABLE = STARTUPHAFENBACKEND_TABLES.PROFILEINFO;
const USER_TABLE = STARTUPHAFENBACKEND_TABLES.SHUSER;
const DEFAULT_USER_ID = 'user-1';

jest.setTimeout(600000);

async function createSchema(knex: Knex) {
  await knex.schema.createTable(USER_TABLE, (table) => {
    table.string('id').primary();
  });

  await knex.schema.createTable(PROFILE_INFO_TABLE, (table) => {
    table.increments('id').primary();
    table
      .string('userId')
      .notNullable()
      .unique()
      .references('id')
      .inTable(USER_TABLE)
      .onDelete('CASCADE');
    table.string('phoneInternational').notNullable();
    table.string('phoneNational').notNullable();
    table.string('phoneNumber').notNullable();
    table.string('website').nullable();
    table.string('birthCountry').nullable();
    table.string('birthPlace').nullable();
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
  });
}

describe('ProfileInfoDbController', () => {
  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await createSchema(postgres.knex);
    await postgres.knex(USER_TABLE).insert({ id: DEFAULT_USER_ID });
  });

  afterAll(async () => {
    await postgres.stop();
  });

  async function runWithController<T>(
    work: (controller: ProfileInfoDbController) => Promise<T>
  ) {
    return postgres.knex.transaction(async (trx) => {
      const controller = new ProfileInfoDbController(trx);
      return work(controller);
    });
  }

  function createDefaultInput(
    overrides: Partial<ProfileInfoInput> = {}
  ): ProfileInfoInput {
    return {
      userId: DEFAULT_USER_ID,
      phoneInternational: '+49',
      phoneNational: '30',
      phoneNumber: '12345678',
      website: null,
      birthCountry: 'Germany',
      birthPlace: 'Berlin',
      ...overrides,
    };
  }

  describe('upsert', () => {
    it('creates a profile info record when none exists', async () => {
      const input = createDefaultInput();

      await runWithController((controller) => controller.upsert(input));

      const stored = await postgres.knex(PROFILE_INFO_TABLE).first();
      expect(stored.id).toBeGreaterThan(0);
      expect(stored.userId).toBe(input.userId);
      expect(stored.phoneInternational).toBe(input.phoneInternational);
      expect(stored.phoneNational).toBe(input.phoneNational);
      expect(stored.phoneNumber).toBe(input.phoneNumber);
      expect(stored.website).toBeNull();
      expect(stored.createdAt).toBeInstanceOf(Date);
    });

    it('creates a profile info record with website', async () => {
      const input = createDefaultInput({ website: 'https://example.com' });

      await runWithController((controller) => controller.upsert(input));

      const stored = await postgres.knex(PROFILE_INFO_TABLE).first();
      expect(stored.website).toBe('https://example.com');
    });

    it('stores the record in the database', async () => {
      const input = createDefaultInput();

      await runWithController((controller) => controller.upsert(input));

      const stored = await postgres.knex(PROFILE_INFO_TABLE).first();
      expect(stored).toMatchObject({
        userId: input.userId,
        phoneInternational: input.phoneInternational,
        phoneNational: input.phoneNational,
        phoneNumber: input.phoneNumber,
      });
    });

    it('updates existing record when userId already exists', async () => {
      const input = createDefaultInput();
      await runWithController((controller) => controller.upsert(input));

      const updatedInput = createDefaultInput({
        phoneNumber: 'updatedPhoneNumber',
      });
      await runWithController((controller) => controller.upsert(updatedInput));

      const stored = await postgres.knex(PROFILE_INFO_TABLE).first();
      expect(stored.phoneNumber).toBe('updatedPhoneNumber');

      const count = await postgres.knex(PROFILE_INFO_TABLE).count();
      expect(Number(count[0].count)).toBe(1);
    });
  });

  describe('getByUserId', () => {
    it('returns profile info for existing userId', async () => {
      const input = createDefaultInput();
      await runWithController((controller) => controller.upsert(input));

      const result = await runWithController((controller) =>
        controller.getByUserId(input.userId)
      );

      expect(result).not.toBeNull();
    });

    it('returns correct profile for specific userId', async () => {
      await postgres.knex(USER_TABLE).insert({ id: 'user-2' });

      await runWithController((controller) =>
        controller.upsert(
          createDefaultInput({
            userId: DEFAULT_USER_ID,
            phoneNumber: 'One',
          })
        )
      );
      await runWithController((controller) =>
        controller.upsert(
          createDefaultInput({
            userId: 'user-2',
            phoneNumber: 'Two',
          })
        )
      );

      const result = await runWithController((controller) =>
        controller.getByUserId('user-2')
      );

      expect(result?.phoneNumber).toBe('Two');
    });
  });
});
