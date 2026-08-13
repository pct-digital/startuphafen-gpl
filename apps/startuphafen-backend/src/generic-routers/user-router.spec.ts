import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../assets-loader';
import { buildUserRouter } from './user-router';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

const baseUser: ShUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  cellPhoneNumber: '0000000000',
  phoneNumber: '0000000001',
  street: 'Some Street',
  postalCode: '12345',
  city: 'Berlin',
  inboxReference: '',
  country: 'Germany',
  dateOfBirth: '1990-01-01',
  academicTitle: null,
  title: null,
  name: null,
  roles: ['login'],
  createdAt: new Date(),
};

const otherUser: ShUser = {
  ...baseUser,
  id: 'user-2',
  email: 'john@example.com',
  firstName: 'John',
};

const createToken = (userId: string, roles: string[], user: ShUser) => ({
  sub: userId,
  email: user.email,
  firstNameBundID: user.firstName,
  lastNameBundID: user.lastName,
  phoneNumberBundID: user.phoneNumber,
  cellphoneNumberBundID: user.cellPhoneNumber,
  dateOfBirthBundID: user.dateOfBirth,
  realm_access: {
    roles,
  },
});

describe('userRouter', () => {
  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(
        async (trx) => await work(trx),
        {
          isolationLevel: 'serializable',
          readOnly,
        }
      );
    };
  };

  const createCaller = (userId: string = baseUser.id) => {
    const user = userId === otherUser.id ? otherUser : baseUser;
    return buildUserRouter().createCaller({
      trxFactory: createTrxFactory(),
      token: createToken(userId, ['login'], user),
    });
  };

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert([baseUser, otherUser]);

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('getUser always returns the authenticated user and not another user record', async () => {
    const caller = createCaller(otherUser.id);

    await expect(caller.getUser()).resolves.toMatchObject({
      firstName: 'John',
      email: 'john@example.com',
    });
  });
});
