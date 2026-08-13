import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Answers,
  Project,
  STARTUPHAFENBACKEND_TABLES,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { TRPCError } from '@trpc/server';
import { migrateDatabase } from '../assets-loader';
import { answerRouter } from './answer-router';

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

const baseProject: Project = {
  createdAt: new Date(),
  id: 100,
  name: 'User 1 Project',
  catalogueId: 'cat-1',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: baseUser.id,
};

const otherProject: Project = {
  ...baseProject,
  id: 200,
  name: 'User 2 Project',
  userId: otherUser.id,
};

const baseAnswer: Answers = {
  id: 1,
  key: 'answer-1',
  projectId: baseProject.id,
  stringValue: 'original-string',
  componentId: 'component-1',
  value: 'original-value',
  type: 'text',
  xmlKey: 'xml-1',
  questionText: 'Original question',
  answerText: 'Original answer',
  headerText: null,
};

const createToken = (userId: string, roles: string[]) => ({
  sub: userId,
  realm_access: {
    roles,
  },
});

describe('answerRouter', () => {
  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(async (trx) => await work(trx), {
        isolationLevel: 'serializable',
        readOnly,
      });
    };
  };

  const createCaller = (userId: string = baseUser.id) => {
    return answerRouter.createCaller({
      trxFactory: createTrxFactory(),
      token: createToken(userId, ['login']),
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

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert([baseProject, otherProject]);

    await postgres
      .knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert(baseAnswer);

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('ignores projectId changes during update', async () => {
    const caller = createCaller();

    await caller.update({
      id: baseAnswer.id,
      updates: {
        answerText: 'Updated answer',
        projectId: otherProject.id,
      } as Record<string, unknown>,
    });

    const updatedAnswer = await postgres
      .knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .where({ id: baseAnswer.id })
      .first();

    expect(updatedAnswer).toMatchObject({
      id: baseAnswer.id,
      projectId: baseProject.id,
      answerText: 'Updated answer',
    });
  });

  it('rejects changing a locked HWK eligibility answer after completion', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({ progress: 100 });

    await postgres
      .knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .where({ id: baseAnswer.id })
      .update({ key: 'Us1' });

    const caller = createCaller();

    await expect(
      caller.update({
        id: baseAnswer.id,
        updates: {
          value: 'us1Ans-2',
        },
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });
});
