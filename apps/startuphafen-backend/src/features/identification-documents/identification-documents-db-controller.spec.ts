import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  IdentificationDocument,
  Project,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { IdentificationDocumentsDbController } from './identification-documents-db-controller';

jest.setTimeout(60_000);

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
  roles: null,
  createdAt: new Date(),
};

const baseDocument = {
  createdAt: new Date(),
  data: new Uint8Array([1, 2, 3]),
  id: 1,
  mimeType: 'image/png',
  fileName: 'Personalausweis.png',
  taxId: '123456789',
  userId: baseUser.id,
  projectId: 1,
};

const baseProject: Project = {
  createdAt: new Date(),
  id: 1,
  name: 'Test Project',
  catalogueId: 'cat-1',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: 'user-1',
};

const postgres = new DockerizedPostgres();

describe('IdentificationDocumentsDbController', () => {
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

  describe('upsertByTaxId', () => {
    it('inserts a new document if no document with taxId exists', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      await fixSequences(postgres.knex);

      await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.upsertByTaxId(baseUser.id, {
          file: new Uint8Array([1, 2, 3]),
          mimeType: 'image/png',
          fileName: 'ausweis-vorne.png',
          taxId: '123456789',
          projectId: 1,
        });
      });

      const dbDocs = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .where({ userId: baseUser.id, taxId: '123456789' });

      expect(dbDocs).toHaveLength(1);
      expect(dbDocs[0]).toMatchObject({
        userId: baseUser.id,
        taxId: '123456789',
        mimeType: 'image/png',
        fileName: 'ausweis-vorne.png',
      });
      expect(new Uint8Array(dbDocs[0].data)).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('updates existing document if document with taxId exists', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert(baseDocument);

      await fixSequences(postgres.knex);

      await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.upsertByTaxId(baseUser.id, {
          file: new Uint8Array([4, 5, 6]),
          mimeType: 'application/jpeg',
          fileName: 'ausweis-hinten.jpeg',
          taxId: '123456789',
          projectId: 1,
        });
      });

      const dbDocs = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .where({ userId: baseUser.id, taxId: '123456789' });

      expect(dbDocs).toHaveLength(1);
      expect(dbDocs[0]).toMatchObject({
        id: 1,
        userId: baseUser.id,
        taxId: '123456789',
        mimeType: 'application/jpeg',
        fileName: 'ausweis-hinten.jpeg',
      });
      expect(new Uint8Array(dbDocs[0].data)).toEqual(new Uint8Array([4, 5, 6]));
    });
  });

  describe('getData', () => {
    it('returns null if no document with taxId exists', async () => {
      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.getData(baseUser.id, '123456789', 1);
      });

      expect(result).toBeNull();
    });

    it('returns document data if document with taxId exists', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert(baseDocument);

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.getData(baseUser.id, '123456789', 1);
      });

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        mimeType: 'image/png',
        fileName: 'Personalausweis.png',
      });
      expect(new Uint8Array(result!.data)).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('returns null if document with taxId exists but belongs to another user', async () => {
      const otherUser: ShUser = {
        ...baseUser,
        id: 'user-2',
      };

      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert([baseUser, otherUser]);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert({
          ...baseDocument,
          userId: otherUser.id,
        });

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.getData(baseUser.id, '123456789', 1);
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteForProject', () => {
    it('deletes all documents for a project', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);
      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, { ...baseProject, id: 2 }]);
      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert([
          baseDocument,
          { ...baseDocument, id: 2, projectId: 2 },
          { ...baseDocument, id: 3, taxId: '987654321' },
        ]);

      const beforeDelete = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .where({ projectId: 1 });

      expect(beforeDelete).toHaveLength(2);

      await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.deleteForProject(1);
      });

      const afterDelete = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .where({ projectId: 1 });

      expect(afterDelete).toHaveLength(0);
    });
  });

  describe('getByProject', () => {
    it('returns all documents for a project', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);
      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, { ...baseProject, id: 2 }]);
      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert([
          baseDocument,
          { ...baseDocument, id: 2, projectId: 2 },
          { ...baseDocument, id: 3, taxId: '987654321' },
        ]);

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.getByProject(1);
      });

      expect(result).toHaveLength(2);
      expect(result[0].taxId).toBe('123456789');
      expect(result[1].taxId).toBe('987654321');
    });

    it('returns empty array if no documents for project exist', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);
      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, { ...baseProject, id: 2 }]);
      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert({ ...baseDocument, id: 2, projectId: 2 });

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);

        return controller.getByProject(1);
      });

      expect(result).toEqual([]);
    });
  });

  describe('deleteDocumentsWithoutProject', () => {
    it('deletes documents that have null projectId', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);
      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);
      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert([
          baseDocument,
          { ...baseDocument, id: 2, projectId: undefined },
          { ...baseDocument, id: 3, projectId: undefined },
        ]);

      const beforeDelete = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .whereNull('projectId');

      expect(beforeDelete).toHaveLength(2);

      const deletedCount = await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);
        return controller.deleteDocumentsWithoutProject();
      });

      expect(deletedCount).toBe(2);

      const afterDelete = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .whereNull('projectId');

      expect(afterDelete).toHaveLength(0);
    });
  });

  describe('deleteDocumentsWithoutProjectForUser', () => {
    it('deletes documents that have null projectId for a specific user', async () => {
      await postgres.knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER).insert([
        baseUser,
        {
          ...baseUser,
          id: 'user-2',
        },
      ]);
      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);
      await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .insert([
          baseDocument,
          { ...baseDocument, id: 2, projectId: undefined },
          { ...baseDocument, id: 3, projectId: undefined, userId: 'user-2' },
        ]);

      const beforeDelete = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .whereNull('projectId');

      expect(beforeDelete).toHaveLength(2);

      await postgres.knex.transaction(async (trx) => {
        const controller = new IdentificationDocumentsDbController(trx);
        return controller.deleteDocumentsWithoutProjectForUser('user-1');
      });

      const afterDelete = await postgres
        .knex<IdentificationDocument>(
          STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT
        )
        .whereNull('projectId');

      expect(afterDelete).toHaveLength(1);
    });
  });
});
