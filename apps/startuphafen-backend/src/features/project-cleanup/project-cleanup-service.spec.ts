import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  IdentificationDocument,
  Project,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { ProjectCleanupService } from './project-cleanup-service';

jest.setTimeout(60_000);

const DAY_MS = 24 * 60 * 60 * 1000;

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

const expiredProject: Project = {
  createdAt: new Date(Date.now() - 8 * DAY_MS),
  id: 1,
  name: 'Expired Project',
  catalogueId: 'kapg',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 50,
  userId: baseUser.id,
};

const freshProject: Project = {
  createdAt: new Date(),
  id: 2,
  name: 'Fresh Project',
  catalogueId: 'eun',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 10,
  userId: baseUser.id,
};

describe('ProjectCleanupService', () => {
  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(async (trx) => await work(trx), {
        isolationLevel: 'serializable',
        readOnly,
      });
    };
  };

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(baseUser);

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert([expiredProject, freshProject]);

    await postgres
      .knex<IdentificationDocument>(
        STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
      )
      .insert([
        {
          id: 1,
          data: new Uint8Array([1, 2, 3]),
          mimeType: 'image/png',
          fileName: 'Personalausweis.png',
          taxId: '123456789',
          userId: baseUser.id,
          projectId: expiredProject.id,
          createdAt: new Date(),
        },
        {
          id: 2,
          data: new Uint8Array([4, 5, 6]),
          mimeType: 'image/png',
          fileName: 'Personalausweis.png',
          taxId: '987654321',
          userId: baseUser.id,
          projectId: freshProject.id,
          createdAt: new Date(),
        },
        {
          id: 3,
          data: new Uint8Array([10, 11, 12]),
          mimeType: 'image/png',
          fileName: 'Personalausweis.png',
          taxId: '111111111',
          userId: baseUser.id,
          projectId: null,
          createdAt: new Date(Date.now() - 8 * DAY_MS),
        },
        {
          id: 4,
          data: new Uint8Array([13, 14, 15]),
          mimeType: 'image/png',
          fileName: 'Personalausweis.png',
          taxId: '222222222',
          userId: baseUser.id,
          projectId: null,
          createdAt: new Date(),
        },
      ]);

    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert({
        id: 1,
        userId: baseUser.id,
        filename: 'Steuerliche_Erfassung_latest.pdf',
        mimeType: 'application/pdf',
        data: new Uint8Array([7, 8, 9]),
        projectId: expiredProject.id,
      });

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('deletes projects older than the retention period including their documents', async () => {
    const service = new ProjectCleanupService(createTrxFactory());

    const deletedCount = await service.deleteExpiredProjects();

    expect(deletedCount).toBe(1);

    const remainingProjects = await postgres.knex<Project>(
      STARTUPHAFENBACKEND_TABLES.PROJECT
    );
    expect(remainingProjects).toHaveLength(1);
    expect(remainingProjects[0].id).toBe(freshProject.id);

    const remainingIdDocs = await postgres.knex<IdentificationDocument>(
      STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
    );
    expect(remainingIdDocs).toHaveLength(1);
    expect(remainingIdDocs[0].id).toBe(2);
    expect(remainingIdDocs[0].projectId).toBe(freshProject.id);

    const remainingUserDocs = await postgres.knex<UserDocument>(
      STARTUPHAFENBACKEND_TABLES.USERDOCUMENT
    );
    expect(remainingUserDocs).toHaveLength(0);

    const remainingUsers = await postgres.knex<ShUser>(
      STARTUPHAFENBACKEND_TABLES.SHUSER
    );
    expect(remainingUsers).toHaveLength(1);
  });

  it('purges orphaned identification documents that have no project', async () => {
    const service = new ProjectCleanupService(createTrxFactory());

    await service.deleteExpiredProjects();

    const remainingOrphans = await postgres
      .knex<IdentificationDocument>(
        STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
      )
      .whereNull('projectId');
    expect(remainingOrphans).toHaveLength(0);
  });

  it('returns zero when nothing is expired', async () => {
    const service = new ProjectCleanupService(createTrxFactory());

    await service.deleteExpiredProjects();
    const secondRun = await service.deleteExpiredProjects();

    expect(secondRun).toBe(0);

    const remainingProjects = await postgres.knex<Project>(
      STARTUPHAFENBACKEND_TABLES.PROJECT
    );
    expect(remainingProjects).toHaveLength(1);
  });
});
