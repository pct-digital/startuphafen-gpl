import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  Project,
  STARTUPHAFENBACKEND_TABLES,
  ShUser,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { UserDocumentDbController } from './user-document-db-controller';

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
  roles: null,
  createdAt: new Date(),
};

const baseUser2: ShUser = {
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
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: 'user-1',
};

const baseProject2: Project = {
  createdAt: new Date(),
  id: 200,
  name: 'Test Project 2',
  catalogueId: 'cat-2',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: 'user-2',
};

describe('UserDocumentDbController', () => {
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

  describe('upload', () => {
    it('uploads a document and returns metadata', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      await fixSequences(postgres.knex);

      const testFile = new Uint8Array([1, 2, 3, 4, 5]);
      const filename = 'test-document.pdf';
      const mimeType = 'application/pdf';

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);

        return controller.upload(baseUser.id, {
          file: testFile,
          filename,
          mimeType,
          projectId: baseProject.id,
        });
      });

      expect(result).toMatchObject({
        id: expect.any(Number),
        filename,
        mimeType,
        createdAt: expect.any(Date),
        documentCase: null,
      });

      const dbDoc = await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .where({ id: result.id })
        .first();

      expect(dbDoc).toMatchObject({
        userId: baseUser.id,
        filename,
        mimeType,
        projectId: baseProject.id,
        documentCase: null,
      });
      if (dbDoc == null) {
        throw new Error('Expected uploaded document to exist');
      }
      expect(Buffer.from(dbDoc.data)).toEqual(Buffer.from(testFile));
    });

    it('uploads a document with documentCase', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      await fixSequences(postgres.knex);

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);

        return await controller.upload(baseUser.id, {
          file: new Uint8Array([9, 8, 7]),
          filename: 'qualification-proof.pdf',
          mimeType: 'application/pdf',
          projectId: baseProject.id,
          documentCase: 'hwk_qualification_proof',
        });
      });

      expect(result.documentCase).toBe('hwk_qualification_proof');
    });

    it('uploads multiple documents for the same project', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      await fixSequences(postgres.knex);

      const result1 = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return controller.upload(baseUser.id, {
          file: new Uint8Array([1, 2, 3]),
          filename: 'doc1.pdf',
          mimeType: 'application/pdf',
          projectId: baseProject.id,
        });
      });

      const result2 = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return controller.upload(baseUser.id, {
          file: new Uint8Array([4, 5, 6]),
          filename: 'doc2.pdf',
          mimeType: 'application/pdf',
          projectId: baseProject.id,
        });
      });

      expect(result1.id).not.toBe(result2.id);
      expect(result1.filename).toBe('doc1.pdf');
      expect(result2.filename).toBe('doc2.pdf');

      const docs = await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .where({ projectId: baseProject.id });

      expect(docs).toHaveLength(2);
    });
  });

  describe('list', () => {
    it('lists all documents in the transaction context for a user', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert([baseUser, baseUser2]);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, baseProject2]);

      await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert([
          {
            userId: baseUser.id,
            filename: 'doc1.pdf',
            mimeType: 'application/pdf',
            data: new Uint8Array([1, 2, 3]),
            projectId: baseProject.id,
          },
          {
            userId: baseUser.id,
            filename: 'doc2.pdf',
            mimeType: 'application/pdf',
            data: new Uint8Array([4, 5, 6]),
            projectId: baseProject.id,
          },
          {
            userId: baseUser2.id,
            filename: 'doc3.pdf',
            mimeType: 'application/pdf',
            data: new Uint8Array([7, 8, 9]),
            projectId: baseProject2.id,
          },
        ]);

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return controller.list(baseUser.id);
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: expect.any(Number),
        filename: 'doc1.pdf',
        mimeType: 'application/pdf',
        createdAt: expect.any(Date),
        projectId: baseProject.id,
      });
      expect(result[1]).toMatchObject({
        id: expect.any(Number),
        filename: 'doc2.pdf',
        mimeType: 'application/pdf',
        createdAt: expect.any(Date),
        projectId: baseProject.id,
      });
    });

    it('returns empty array when no documents exist', async () => {
      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return controller.list(baseUser.id);
      });

      expect(result).toEqual([]);
    });
  });

  describe('getData', () => {
    beforeEach(async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert([baseUser, baseUser2]);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, baseProject2]);

      await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert({
          id: 301,
          userId: baseUser.id,
          filename: 'owned-document.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject.id,
        });

      await fixSequences(postgres.knex);
    });

    it('returns document bytes for the matching user and document id', async () => {
      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return await controller.getData(baseUser.id, 301);
      });

      expect(result?.id).toBe(301);
      expect(Buffer.from(result?.data ?? [])).toEqual(Buffer.from([1, 2, 3]));
    });

    it('returns null when the project filter does not match', async () => {
      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return await controller.getData(baseUser.id, 301, baseProject2.id);
      });

      expect(result).toBeNull();
    });
  });

  describe('case-based queries', () => {
    beforeEach(async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert([baseUser, baseUser2]);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, baseProject2]);

      await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert([
          {
            userId: baseUser.id,
            filename: 'qualification-1.pdf',
            mimeType: 'application/pdf',
            documentCase: 'hwk_qualification_proof',
            data: new Uint8Array([1, 2, 3]),
            projectId: baseProject.id,
          },
          {
            userId: baseUser.id,
            filename: 'qualification-2.pdf',
            mimeType: 'application/pdf',
            documentCase: 'hwk_qualification_proof',
            data: new Uint8Array([4, 5]),
            projectId: baseProject.id,
          },
          {
            userId: baseUser.id,
            filename: 'hr-extract.pdf',
            mimeType: 'application/pdf',
            documentCase: 'hwk_hr_extract',
            data: new Uint8Array([9, 9, 9, 9]),
            projectId: baseProject.id,
          },
          {
            userId: baseUser.id,
            filename: 'legacy-doc.pdf',
            mimeType: 'application/pdf',
            documentCase: null,
            data: new Uint8Array([5]),
            projectId: baseProject.id,
          },
          {
            userId: baseUser2.id,
            filename: 'other-user-qualification.pdf',
            mimeType: 'application/pdf',
            documentCase: 'hwk_qualification_proof',
            data: new Uint8Array([7, 7, 7]),
            projectId: baseProject2.id,
          },
        ]);
    });

    it('listByProjectAndCase filters by user, project and case', async () => {
      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return await controller.listByProjectAndCase(
          baseUser.id,
          baseProject.id,
          'hwk_qualification_proof'
        );
      });

      expect(result).toHaveLength(2);
      expect(result.map((row) => row.filename)).toEqual([
        'qualification-1.pdf',
        'qualification-2.pdf',
      ]);
      expect(
        result.every((row) => row.documentCase === 'hwk_qualification_proof')
      ).toBe(true);
    });

    it('getCaseStats returns count and total bytes for one case', async () => {
      const stats = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return await controller.getCaseStats(
          baseUser.id,
          baseProject.id,
          'hwk_qualification_proof'
        );
      });

      expect(stats.count).toBe(2);
      expect(stats.totalBytes).toBe(5);
    });

    it('listHwkMailAttachments returns only allowed hwk cases with data', async () => {
      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return await controller.listHwkMailAttachments(
          baseUser.id,
          baseProject.id
        );
      });

      expect(result).toHaveLength(3);
      expect(result.map((row) => row.documentCase)).toEqual([
        'hwk_qualification_proof',
        'hwk_qualification_proof',
        'hwk_hr_extract',
      ]);
      expect(result.every((row) => row.data.byteLength > 0)).toBe(true);
    });
  });

  describe('delete', () => {
    it('deletes a document and returns its id', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      const [doc] = await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert({
          userId: baseUser.id,
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject.id,
        })
        .returning(['id']);

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return controller.delete(doc.id, baseUser.id);
      });

      expect(result).toBe(doc.id);

      const deletedDoc = await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .where({ id: doc.id })
        .first();

      expect(deletedDoc).toBeUndefined();
    });

    it('only deletes the specified document', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert(baseProject);

      const docs = await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert([
          {
            userId: baseUser.id,
            filename: 'doc1.pdf',
            mimeType: 'application/pdf',
            data: new Uint8Array([1, 2, 3]),
            projectId: baseProject.id,
          },
          {
            userId: baseUser.id,
            filename: 'doc2.pdf',
            mimeType: 'application/pdf',
            data: new Uint8Array([4, 5, 6]),
            projectId: baseProject.id,
          },
        ])
        .returning(['id']);

      await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return controller.delete(docs[0].id, baseUser.id);
      });

      const remainingDocs = await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .where({ projectId: baseProject.id });

      expect(remainingDocs).toHaveLength(1);
      expect(remainingDocs[0].id).toBe(docs[1].id);
    });
  });

  describe('listByProject', () => {
    it('lists sorted documents for a user and project', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert([baseUser, baseUser2]);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, baseProject2]);

      await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert({
          id: 301,
          userId: baseUser.id,
          filename: 'owned-document.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject.id,
          createdAt: new Date('2026-02-19T10:00:00.000Z'),
        });
      await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert({
          id: 302,
          userId: baseUser.id,
          filename: 'owned-document.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject.id,
          createdAt: new Date('2026-02-18T10:00:00.000Z'),
        });
      await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert({
          id: 303,
          userId: baseUser.id,
          filename: 'owned-document.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject2.id,
        });

      await fixSequences(postgres.knex);

      const result = await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return await controller.listByProject(baseUser.id, baseProject.id);
      });

      expect(result?.length).toBe(2);
      expect(result?.[0].id).toBe(302);
      expect(result?.[1].id).toBe(301);
    });
  });

  describe('updateContent', () => {
    it('updates file content', async () => {
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert([baseUser, baseUser2]);

      await postgres
        .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
        .insert([baseProject, baseProject2]);

      await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .insert({
          id: 301,
          userId: baseUser.id,
          filename: 'owned-document.pdf',
          mimeType: 'application/pdf',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject.id,
        });

      await fixSequences(postgres.knex);

      await postgres.knex.transaction(async (trx) => {
        const controller = new UserDocumentDbController(trx);
        return await controller.updateContent(301, new Uint8Array([3, 4, 5]));
      });

      const dbDoc = await postgres
        .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
        .where({ id: 301 })
        .first();

      expect(Buffer.from(dbDoc!.data)).toEqual(Buffer.from([3, 4, 5]));
    });
  });
});
