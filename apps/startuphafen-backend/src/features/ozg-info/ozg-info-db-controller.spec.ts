import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  OzgInfo,
  Project,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { OzgInfoDbController } from './ozg-info-db-controller';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

const baseUser: ShUser = {
  id: 'user-ozg-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  cellPhoneNumber: '0000000000',
  phoneNumber: '0000000001',
  street: 'Some Street',
  postalCode: '24103',
  city: 'Kiel',
  country: 'Germany',
  dateOfBirth: '1990-01-01',
  academicTitle: null,
  title: null,
  name: null,
  roles: null,
  inboxReference: null,
  createdAt: new Date(),
};

const projectA: Project = {
  createdAt: new Date(),
  id: 3001,
  name: 'Project A',
  catalogueId: 'eun',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: baseUser.id,
};

const projectB: Project = {
  createdAt: new Date(),
  id: 3002,
  name: 'Project B',
  catalogueId: 'eun',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: baseUser.id,
};

describe('OzgInfoDbController', () => {
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
      .insert([projectA, projectB]);

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('replaceForProject replaces rows and keeps only entries with a non-empty domain', async () => {
    const now = new Date();
    await postgres.knex<OzgInfo>(STARTUPHAFENBACKEND_TABLES.OZGINFO).insert({
      projectId: projectA.id,
      plz: '24103',
      kreis: 'Old Kreis',
      gemeinde: 'Old Gemeinde',
      amt: 'Old Amt',
      amtCode: '000',
      domain: 'https://old.example.de',
      createdAt: now,
      oeid: '123456',
    });

    const persistedCount = await postgres.knex.transaction(async (trx) => {
      const controller = new OzgInfoDbController(trx);
      return controller.replaceForProject(projectA.id, '24103', [
        {
          kreis: 'Kreis Rendsburg-Eckernfoerde',
          gemeinde: 'Kiel',
          amt: 'Landeshauptstadt Kiel',
          amtCode: '001',
          domain: 'https://kiel.example.de',
          oeid: '12345',
        },
        {
          kreis: 'Kreis Rendsburg-Eckernfoerde',
          gemeinde: 'Kiel',
          amt: 'Landeshauptstadt Kiel',
          amtCode: '001',
          domain: '   ',
          oeid: '12345',
        },
      ]);
    });

    expect(persistedCount).toBe(1);

    const rows = await postgres
      .knex<OzgInfo>(STARTUPHAFENBACKEND_TABLES.OZGINFO)
      .where({ projectId: projectA.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe('https://kiel.example.de');
    expect(rows[0].amtCode).toBe('001');
  });

  test('replaceForProject filters out entries without OEID', async () => {
    await postgres.knex.transaction(async (trx) => {
      const controller = new OzgInfoDbController(trx);
      return controller.replaceForProject(projectA.id, '24103', [
        {
          kreis: 'Kreis Rendsburg-Eckernfoerde',
          gemeinde: 'Kiel',
          amt: 'Landeshauptstadt Kiel',
          amtCode: '001',
          domain: 'https://kiel.example.de',
        },
      ]);
    });

    const rows = await postgres
      .knex<OzgInfo>(STARTUPHAFENBACKEND_TABLES.OZGINFO)
      .where({ projectId: projectA.id });

    expect(rows).toHaveLength(0);
  });

  it('getByProjectId returns rows for the requested project only', async () => {
    const now = new Date();
    await postgres.knex<OzgInfo>(STARTUPHAFENBACKEND_TABLES.OZGINFO).insert([
      {
        projectId: projectA.id,
        plz: '24103',
        kreis: 'Kreis A',
        gemeinde: 'Gemeinde A',
        amt: 'Amt A',
        amtCode: '001',
        domain: 'https://a.example.de',
        createdAt: now,
        oeid: '12345',
      },
      {
        projectId: projectB.id,
        plz: '24159',
        kreis: 'Kreis B',
        gemeinde: 'Gemeinde B',
        amt: 'Amt B',
        amtCode: '002',
        domain: 'https://b.example.de',
        createdAt: now,
        oeid: '12346',
      },
    ]);

    const projectRows = await postgres.knex.transaction(async (trx) => {
      const controller = new OzgInfoDbController(trx);
      return controller.getByProjectId(projectA.id);
    });

    expect(projectRows).toHaveLength(1);
    expect(projectRows[0].projectId).toBe(projectA.id);
    expect(projectRows[0].domain).toBe('https://a.example.de');
  });

  it('getUniqueAmtsByProjectId returns distinct amt + amtCode + domain rows', async () => {
    const now = new Date();
    await postgres.knex<OzgInfo>(STARTUPHAFENBACKEND_TABLES.OZGINFO).insert([
      {
        projectId: projectA.id,
        plz: '24103',
        kreis: 'Kreis A',
        gemeinde: 'Gemeinde A',
        amt: 'Amt Alpha',
        amtCode: '001',
        domain: 'https://alpha.example.de',
        createdAt: now,
        oeid: '12345',
      },
      {
        projectId: projectA.id,
        plz: '24103',
        kreis: 'Kreis A',
        gemeinde: 'Gemeinde A 2',
        amt: 'Amt Alpha',
        amtCode: '001',
        domain: 'https://alpha.example.de',
        createdAt: now,
        oeid: '12345',
      },
      {
        projectId: projectA.id,
        plz: '24159',
        kreis: 'Kreis B',
        gemeinde: 'Gemeinde B',
        amt: 'Amt Beta',
        amtCode: '002',
        domain: 'https://beta.example.de',
        createdAt: now,
        oeid: '12346',
      },
    ]);

    const uniqueRows = await postgres.knex.transaction(async (trx) => {
      const controller = new OzgInfoDbController(trx);
      return controller.getUniqueAmtsByProjectId(projectA.id);
    });

    expect(uniqueRows).toEqual([
      {
        amt: 'Amt Alpha',
        amtCode: '001',
        domain: 'https://alpha.example.de',
      },
      {
        amt: 'Amt Beta',
        amtCode: '002',
        domain: 'https://beta.example.de',
      },
    ]);
  });
});
