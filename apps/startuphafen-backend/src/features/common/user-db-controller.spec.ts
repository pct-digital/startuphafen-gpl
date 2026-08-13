import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { UserDbController } from './user-db-controller';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

const baseShUser: ShUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  cellPhoneNumber: '0000000000',
  phoneNumber: '0000000001',
  street: 'Test Street',
  postalCode: '00000',
  city: 'Berlin',
  country: 'Germany',
  dateOfBirth: '1990-01-01',
  academicTitle: null,
  title: null,
  name: null,
  roles: null,
  createdAt: new Date(),
  inboxReference: null,
  id: '',
};

describe('UserDbController', () => {
  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('should get user by id', async () => {
    const testUser: ShUser = {
      ...baseShUser,
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    };

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(testUser);

    // Always use fixSequences after setting up any test data
    await fixSequences(postgres.knex);

    const result = await postgres.knex.transaction(async (trx) => {
      return new UserDbController(trx).getUserById('user-123');
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe('user-123');
    expect(result?.firstName).toBe('John');
    expect(result?.email).toBe('john@example.com');
  });

  it('should return undefined when user id does not exist', async () => {
    const result = await postgres.knex.transaction(async (trx) => {
      return new UserDbController(trx).getUserById('nonexistent-id');
    });

    expect(result).toBeUndefined();
  });

  it('should get user count with multiple users', async () => {
    const users: ShUser[] = [
      {
        ...baseShUser,
        id: 'user-1',
      },
      {
        ...baseShUser,
        id: 'user-2',
      },
    ];

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(users);

    // Always use fixSequences after setting up any test data
    await fixSequences(postgres.knex);

    const count = await postgres.knex.transaction(async (trx) => {
      return new UserDbController(trx).getUserCount();
    });

    expect(count).toBe(2);
  });

  it('should return 0 user count when no users exist', async () => {
    const count = await postgres.knex.transaction(async (trx) => {
      return new UserDbController(trx).getUserCount();
    });

    expect(count).toBe(0);
  });

  it('should get user created ratio grouped by date', async () => {
    const today = new Date('2000-01-01');
    const yesterday = new Date('1999-12-31');

    const users: ShUser[] = [
      {
        ...baseShUser,
        id: 'user-1',
        createdAt: today,
      },
      {
        ...baseShUser,
        id: 'user-2',
        createdAt: today,
      },
      {
        ...baseShUser,
        id: 'user-3',
        createdAt: yesterday,
      },
    ];

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(users);

    // Always use fixSequences after setting up any test data
    await fixSequences(postgres.knex);

    const ratio = await postgres.knex.transaction(async (trx) => {
      return new UserDbController(trx).getUserCreatedRatio();
    });

    expect(ratio).toHaveLength(2);
    expect(ratio[0].amount).toBe(1);
    expect(ratio[1].amount).toBe(2);
    expect(ratio[0].createdAt).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(ratio[1].createdAt).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('should return empty array for user created ratio when no users exist', async () => {
    const ratio = await postgres.knex.transaction(async (trx) => {
      return new UserDbController(trx).getUserCreatedRatio();
    });

    expect(ratio).toEqual([]);
  });
});
