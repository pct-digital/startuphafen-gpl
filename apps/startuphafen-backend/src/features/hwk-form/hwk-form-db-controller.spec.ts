import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  Answers,
  ProfileInfo,
  Project,
  QuestionTracking,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { HwkFormDbController } from './hwk-form-db-controller';

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

describe('HwkFormDbController', () => {
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
      .insert(baseProject);

    const now = new Date();
    await postgres.knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS).insert({
      projectId: baseProject.id,
      key: 'HwkTrade',
      componentId: 'HwkTrade',
      stringValue: null,
      xmlKey: '/',
      value: 'Goldschmied',
      type: 'string',
      questionText: 'Question',
      answerText: 'Answer',
      headerText: null,
    });

    await postgres
      .knex<QuestionTracking>(STARTUPHAFENBACKEND_TABLES.QUESTIONTRACKING)
      .insert({
        projectId: baseProject.id,
        answeredQuestions: ['HwkTrade'],
      } as any);

    await postgres
      .knex<ProfileInfo>(STARTUPHAFENBACKEND_TABLES.PROFILEINFO)
      .insert({
        id: 1,
        userId: baseUser.id,
        phoneNumber: '1234567',
        phoneInternational: '+49',
        phoneNational: '30',
        website: null,
        createdAt: now,
      });

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('getProjectById returns project', async () => {
    const project = await postgres.knex.transaction(async (trx) => {
      return new HwkFormDbController(trx).getProjectById(baseProject.id);
    });

    expect(project?.id).toBe(baseProject.id);
  });

  it('getAnswersByProjectId returns answers', async () => {
    const answers = await postgres.knex.transaction(async (trx) => {
      return new HwkFormDbController(trx).getAnswersByProjectId(baseProject.id);
    });

    expect(answers).toHaveLength(1);
    expect(answers[0].key).toBe('HwkTrade');
  });

  it('getQuestionTrackingByProjectId returns tracking row', async () => {
    const tracking = await postgres.knex.transaction(async (trx) => {
      return new HwkFormDbController(trx).getQuestionTrackingByProjectId(
        baseProject.id
      );
    });

    expect(tracking?.projectId).toBe(baseProject.id);
    expect(tracking?.answeredQuestions).toEqual(['HwkTrade']);
  });

  it('getUserById returns user', async () => {
    const user = await postgres.knex.transaction(async (trx) => {
      return new HwkFormDbController(trx).getUserById(baseUser.id);
    });

    expect(user?.id).toBe(baseUser.id);
  });

  it('getProfileInfoByUserId returns profile info', async () => {
    const profile = await postgres.knex.transaction(async (trx) => {
      return new HwkFormDbController(trx).getProfileInfoByUserId(baseUser.id);
    });

    expect(profile?.userId).toBe(baseUser.id);
  });

});
