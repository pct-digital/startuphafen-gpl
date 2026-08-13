import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  Answers,
  Project,
  STARTUPHAFENBACKEND_TABLES,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { AnswerDbController } from './answer-db-controller';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

const baseAnswer: Omit<Answers, 'id'> = {
  key: 'existing-answer',
  projectId: 100,
  stringValue: 'original-string',
  componentId: 'component-1',
  value: 'original-value',
  type: 'text',
  xmlKey: 'xml-1',
  questionText: 'Original question',
  answerText: 'Original answer',
  headerText: null,
};

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
  catalogueId: 'cat-1',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: 'user-1',
};

describe('AnswerDbController', () => {
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

  it('upserts inserts and updates in a single batch', async () => {
    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(baseUser);

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(baseProject);

    await postgres
      .knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert({ ...baseAnswer, id: 1 });

    await fixSequences(postgres.knex);

    const result = await postgres.knex.transaction(async (trx) => {
      const controller = new AnswerDbController(trx);

      return controller.upsertBatch(
        [
          {
            key: baseAnswer.key,
            projectId: baseAnswer.projectId,
            stringValue: 'updated-string',
            componentId: 'component-1',
            value: 'updated-value',
            type: 'text',
            xmlKey: 'xml-1',
            questionText: 'Updated question',
            answerText: 'Updated answer',
            headerText: 'Header',
          },
          {
            key: 'new-answer',
            projectId: baseAnswer.projectId,
            stringValue: 'new-string',
            componentId: 'component-2',
            value: 'new-value',
            type: 'text',
            xmlKey: 'xml-2',
            questionText: 'New question',
            answerText: 'New answer',
            headerText: null,
          },
        ],
        baseAnswer.projectId
      );
    });

    expect(result[baseAnswer.key]).toBe(1);
    expect(result['new-answer']).toBeGreaterThan(1);

    const answers = await postgres
      .knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .where({ projectId: baseAnswer.projectId })
      .orderBy('id', 'asc');

    expect(answers).toHaveLength(2);
    expect(answers[0]).toMatchObject({
      id: 1,
      value: 'updated-value',
      answerText: 'Updated answer',
      headerText: 'Header',
    });
    expect(answers[1]).toMatchObject({
      key: 'new-answer',
      value: 'new-value',
      componentId: 'component-2',
    });
  });

  it('throws when answers contain different project ids', async () => {
    await expect(
      postgres.knex.transaction(async (trx) => {
        const controller = new AnswerDbController(trx);

        return controller.upsertBatch(
          [
            {
              key: 'first-answer',
              projectId: 1,
              stringValue: null,
              componentId: 'component-1',
              value: 'value-1',
              type: 'text',
              xmlKey: 'xml-1',
              questionText: 'Question 1',
              answerText: 'Answer 1',
              headerText: null,
            },
            {
              key: 'second-answer',
              projectId: 2,
              stringValue: null,
              componentId: 'component-2',
              value: 'value-2',
              type: 'text',
              xmlKey: 'xml-2',
              questionText: 'Question 2',
              answerText: 'Answer 2',
              headerText: null,
            },
          ],
          1
        );
      })
    ).rejects.toThrow('ProjectIds not identical!');
  });
});
