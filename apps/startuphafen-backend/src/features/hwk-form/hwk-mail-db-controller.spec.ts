import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  HwkMailLog,
  Project,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { HwkMailDbController, HwkMailLogRow } from './hwk-mail-db-controller';

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
  country: 'Germany',
  dateOfBirth: '1990-01-01',
  academicTitle: null,
  title: null,
  name: null,
  roles: null,
  inboxReference: null,
  createdAt: new Date(),
};

const baseProject: Project = {
  createdAt: new Date(),
  id: 100,
  name: 'Test Project',
  catalogueId: 'eun',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 100,
  userId: 'user-1',
};

const buildLogInsert = (
  projectId: number,
  userId: string,
  overrides: Partial<Omit<HwkMailLogRow, 'id'>> = {}
): Omit<HwkMailLogRow, 'id'> => {
  const now = new Date();
  return {
    projectId,
    userId,
    status: 'pending',
    recipient: 'hwk@example.com',
    cc: null,
    replyTo: null,
    subject: 'HWK-Antrag',
    mailBody: null,
    mailFrom: null,
    mailContentType: null,
    lastError: null,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: now,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe('HwkMailDbController', () => {
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
      .insert([
        baseProject,
        { ...baseProject, id: baseProject.id + 1, name: 'Test Project 2' },
        { ...baseProject, id: baseProject.id + 2, name: 'Test Project 3' },
        { ...baseProject, id: baseProject.id + 3, name: 'Test Project 4' },
      ]);
    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('insert, getByProjectId and getById return persisted log', async () => {
    const result = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      const inserted = await controller.insert(
        buildLogInsert(baseProject.id, baseUser.id)
      );
      const byProject = await controller.getByProjectId(baseProject.id);
      const byId = await controller.getById(inserted.id);

      return { inserted, byProject, byId };
    });

    expect(result.inserted.id).toBeGreaterThan(0);
    expect(result.byProject?.id).toBe(result.inserted.id);
    expect(result.byId?.id).toBe(result.inserted.id);
  });

  it('updateById updates row and returns updated values', async () => {
    const result = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      const inserted = await controller.insert(
        buildLogInsert(baseProject.id, baseUser.id)
      );

      const updated = await controller.updateById(inserted.id, {
        status: 'failed',
        lastError: 'mail failed',
        attemptCount: 1,
      });
      return { inserted, updated };
    });

    expect(result.updated).toBeDefined();
    expect(result.updated?.status).toBe('failed');
    expect(result.updated?.lastError).toBe('mail failed');
    expect(result.updated?.attemptCount).toBe(1);
  });

  it('upsertPendingByProjectId inserts and updates existing row', async () => {
    const now = new Date();
    const first = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      return controller.upsertPendingByProjectId({
        projectId: baseProject.id,
        userId: baseUser.id,
        recipient: 'to@example.com',
        cc: null,
        replyTo: null,
        subject: 'First',
        now,
      });
    });

    const second = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      return controller.upsertPendingByProjectId({
        projectId: baseProject.id,
        userId: baseUser.id,
        recipient: 'to2@example.com',
        cc: 'cc2@example.com',
        replyTo: 'reply2@example.com',
        subject: 'Second',
        now: new Date(now.getTime() + 1000),
      });
    });

    expect(first.id).toBe(second.id);
    expect(second.subject).toBe('Second');
    expect(second.recipient).toBe('to2@example.com');
    expect(second.cc).toBe('cc2@example.com');
  });

  it('findDueLogs returns pending due logs and stale sending logs', async () => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 5 * 60_000);

    await postgres
      .knex<HwkMailLog>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .insert([
        buildLogInsert(baseProject.id, baseUser.id, {
          status: 'pending',
          nextAttemptAt: new Date(now.getTime() - 60_000),
        }),
        buildLogInsert(baseProject.id + 1, baseUser.id, {
          status: 'failed',
          projectId: baseProject.id + 1,
          nextAttemptAt: new Date(now.getTime() - 30_000),
        }),
        buildLogInsert(baseProject.id + 2, baseUser.id, {
          status: 'sending',
          projectId: baseProject.id + 2,
          updatedAt: new Date(staleBefore.getTime() - 1000),
        }),
        buildLogInsert(baseProject.id + 3, baseUser.id, {
          status: 'pending',
          projectId: baseProject.id + 3,
          nextAttemptAt: new Date(now.getTime() + 5 * 60_000),
        }),
      ]);

    const due = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      return controller.findDueLogs(now, staleBefore, 10);
    });

    const statuses = due.map((item) => item.status);
    expect(due).toHaveLength(3);
    expect(statuses).toEqual(
      expect.arrayContaining(['pending', 'failed', 'sending'])
    );
  });

  it('claimForSending updates eligible row to sending', async () => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 5 * 60_000);

    const inserted = await postgres.knex
      .table(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .insert(
        buildLogInsert(baseProject.id, baseUser.id, {
          status: 'pending',
          nextAttemptAt: new Date(now.getTime() - 10_000),
        }),
        '*'
      );

    const claimed = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      return controller.claimForSending(inserted[0].id, now, staleBefore);
    });

    expect(claimed).toBeDefined();
    expect(claimed?.status).toBe('sending');
  });

  it('claimForSending returns undefined for ineligible row', async () => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 5 * 60_000);

    const inserted = await postgres.knex
      .table(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .insert(
        buildLogInsert(baseProject.id, baseUser.id, {
          status: 'pending',
          nextAttemptAt: new Date(now.getTime() + 60_000),
        }),
        '*'
      );

    const claimed = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      return controller.claimForSending(inserted[0].id, now, staleBefore);
    });

    expect(claimed).toBeUndefined();
  });

  it('claimForSending claims due failed rows for retry', async () => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 5 * 60_000);

    const inserted = await postgres.knex
      .table(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .insert(
        buildLogInsert(baseProject.id, baseUser.id, {
          status: 'failed',
          nextAttemptAt: new Date(now.getTime() - 10_000),
        }),
        '*'
      );

    const claimed = await postgres.knex.transaction(async (trx) => {
      const controller = new HwkMailDbController(trx);
      return controller.claimForSending(inserted[0].id, now, staleBefore);
    });

    expect(claimed).toBeDefined();
    expect(claimed?.status).toBe('sending');
  });
});
