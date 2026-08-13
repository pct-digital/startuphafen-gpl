import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Answers,
  Project,
  QuestionTracking,
  STARTUPHAFENBACKEND_TABLES,
  ShUser,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { TRPCError } from '@trpc/server';
import { migrateDatabase } from '../assets-loader';
import { projectRouter } from './project-router';

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
  name: 'Test Project',
  catalogueId: 'cat-1',
  gwSent: true,
  stSent: true,
  lastPosition: 0,
  progress: 100,
  userId: baseUser.id,
};

const secondOwnProject: Project = {
  createdAt: new Date(),
  id: 101,
  name: 'Second Project',
  catalogueId: 'cat-2',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 10,
  userId: baseUser.id,
};

const foreignProject: Project = {
  createdAt: new Date(),
  id: 102,
  name: 'Foreign Project',
  catalogueId: 'cat-3',
  gwSent: false,
  stSent: true,
  lastPosition: 0,
  progress: 55,
  userId: otherUser.id,
};

const createToken = (userId: string, roles: string[]) => ({
  sub: userId,
  realm_access: {
    roles,
  },
});

describe('projectRouter', () => {
  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(async (trx) => await work(trx), {
        isolationLevel: 'serializable',
        readOnly,
      });
    };
  };

  const createCaller = (userId: string = baseUser.id) => {
    return projectRouter.createCaller({
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
      .insert(baseProject);

    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert([
        {
          id: 501,
          userId: baseUser.id,
          filename: 'Steuerliche_Erfassung_latest.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject.id,
        },
        {
          id: 502,
          userId: baseUser.id,
          filename: 'Gewerbeanmeldung_latest.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([4, 5, 6]),
          projectId: baseProject.id,
        },
        {
          id: 503,
          userId: baseUser.id,
          filename: 'qualification-proof.pdf',
          mimeType: 'application/pdf',
          documentCase: 'hwk_qualification_proof',
          data: new Uint8Array([7, 8]),
          projectId: baseProject.id,
        },
        {
          id: 504,
          userId: baseUser.id,
          filename: 'hr-extract.pdf',
          mimeType: 'application/pdf',
          documentCase: 'hwk_hr_extract',
          data: new Uint8Array([9, 10]),
          projectId: baseProject.id,
        },
      ]);

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('readAndAppendDocs returns document metadata without PDF bytes', async () => {
    const caller = createCaller();

    const result = await caller.readAndAppendDocs();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: baseProject.id,
      stEr: {
        id: 501,
        filename: 'Steuerliche_Erfassung_latest.pdf',
        mimeType: 'application/pdf',
      },
      gewA: {
        id: 502,
        filename: 'Gewerbeanmeldung_latest.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(result[0].hwkDocuments).toEqual([
      {
        id: 503,
        filename: 'qualification-proof.pdf',
        mimeType: 'application/pdf',
        createdAt: expect.any(Date),
        documentCase: 'hwk_qualification_proof',
      },
      {
        id: 504,
        filename: 'hr-extract.pdf',
        mimeType: 'application/pdf',
        createdAt: expect.any(Date),
        documentCase: 'hwk_hr_extract',
      },
    ]);
    expect(
      Object.prototype.hasOwnProperty.call(result[0].stEr ?? {}, 'data')
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(result[0].hwkDocuments[0], 'data')
    ).toBe(false);
  });

  it('readFiltered always scopes results to the authenticated user', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert([secondOwnProject, foreignProject]);

    const caller = createCaller();

    const result = await caller.readFiltered({});

    expect(result).toHaveLength(2);
    expect(result.map((project) => project.id).sort((a, b) => a - b)).toEqual([
      baseProject.id,
      secondOwnProject.id,
    ]);
    expect(result.every((project) => project.userId === baseUser.id)).toBe(
      true
    );
  });

  it('readFiltered applies optional filters on top of ownership', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert([secondOwnProject, foreignProject]);

    const caller = createCaller();

    const result = await caller.readFiltered({ name: secondOwnProject.name });

    expect(result).toEqual([secondOwnProject]);
  });

  it('pickFiltered always scopes empty filters to the authenticated user', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert([secondOwnProject, foreignProject]);

    const caller = createCaller();

    const result = await caller.pickFiltered({
      pick: ['userId', 'id', 'name'],
      filters: {},
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { userId: baseUser.id, id: baseProject.id, name: baseProject.name },
      {
        userId: baseUser.id,
        id: secondOwnProject.id,
        name: secondOwnProject.name,
      },
    ]);
  });

  it('readDocumentData returns PDF bytes for an allowed document', async () => {
    const caller = createCaller();

    const result = await caller.readDocumentData({
      projectId: baseProject.id,
      docId: 503,
    });

    expect(result).toEqual({
      data: new Uint8Array([7, 8]),
    });
  });

  it('readDocumentData rejects access to a foreign project', async () => {
    const caller = createCaller(otherUser.id);

    await expect(
      caller.readDocumentData({
        projectId: baseProject.id,
        docId: 503,
      })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'User is not allowed to access this project',
    } satisfies Partial<TRPCError>);
  });

  it('read returns no data when querying a foreign project id', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(foreignProject);

    const caller = createCaller();

    await expect(caller.read(foreignProject.id)).resolves.toEqual([]);
  });

  it('rejects directly setting progress to 100 on an incomplete project', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(secondOwnProject);

    const caller = createCaller();

    await expect(
      caller.update({
        id: secondOwnProject.id,
        updates: {
          progress: 100,
        },
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('allows marking a project as finished after answers and question tracking were saved', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(secondOwnProject);

    await postgres.knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS).insert({
      id: 900,
      key: 'Us1',
      projectId: secondOwnProject.id,
      stringValue: null,
      componentId: 'Us1',
      value: 'us1Ans-2',
      type: 'text',
      xmlKey: '/',
      questionText: 'Us1',
      answerText: 'Us1',
      headerText: null,
    });

    await postgres
      .knex<QuestionTracking>(STARTUPHAFENBACKEND_TABLES.QUESTIONTRACKING)
      .insert({
        projectId: secondOwnProject.id,
        answeredQuestions: ['Us1'],
      });

    const caller = createCaller();

    await expect(
      caller.markQuestionnaireComplete(secondOwnProject.id)
    ).resolves.toBeUndefined();

    const updatedProject = await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: secondOwnProject.id })
      .first();

    expect(updatedProject?.progress).toBe(100);
  });

  it('rejects setting submission flags on an incomplete project', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(secondOwnProject);

    const caller = createCaller();

    await expect(
      caller.update({
        id: secondOwnProject.id,
        updates: {
          stSent: true,
          gwSent: true,
        },
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });
});
