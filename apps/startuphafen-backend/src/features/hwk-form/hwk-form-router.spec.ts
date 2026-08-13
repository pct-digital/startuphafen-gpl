import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Answers,
  FeatureFlag,
  OzgInfo,
  Project,
  QuestionTracking,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { TRPCError } from '@trpc/server';
import { migrateDatabase } from '../../assets-loader';
import { ConfigSchema, ServerConfig } from '../../config';
import { answerRouter } from '../../generic-routers/answer-router';
import { MailClient } from '../common/mail';
import * as HwkApplicationPdf from './hwk-application-pdf';
import { HwkFormPdfService } from './hwk-form-pdf-service';
import { buildHwkFormRouter } from './hwk-form-router';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

const baseUser: ShUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  cellPhoneNumber: '0000000000',
  phoneNumber: '0000000001',
  street: 'Some Street 5',
  postalCode: '12345',
  city: 'Berlin',
  country: 'Germany',
  dateOfBirth: '1990-01-01',
  academicTitle: null,
  title: null,
  name: null,
  roles: ['bundID-high'],
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
  progress: 10,
  userId: baseUser.id,
};

const baseConfig: ServerConfig = ConfigSchema.parse({
  express: {
    host: '127.0.0.1',
    port: 5000,
  },
  knex: {
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      port: 5432,
      user: 'app',
      database: 'app',
      password: 'app',
    },
  },
  mail: {
    host: 'maildev',
    port: 1025,
    user: 'sh',
    password: 'sh',
    from: 'noreply@placeholder.invalid',
    hwkRecipient: 'hwk@example.com',
    disableHwkDelivery: false,
    supportRecipient: 'test',
    feedbackRecipient: 'feedback@placeholder.invalid',
    supportCC: 'test',
  },
  allowedOrigins: [],
  keycloak: {
    jwksUri:
      'http://localhost:8080/realms/startuphafen/protocol/openid-connect/certs',
    host: 'http://localhost:8080',
    user: 'admin',
    password: 'admin',
    realm: 'startuphafen',
    clientId: 'startuphafen_app',
  },
  matchingStrapi: {
    url: 'https://example.com',
  },
  watermarkConfig: {
    text: '',
  },
  eric: {},
  strapi: {},
  ozg: {},
});

const createToken = () => ({
  sub: baseUser.id,
  realm_access: {
    roles: ['bundID-high'],
  },
});

describe('HwkFormRouter', () => {
  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(async (trx) => await work(trx), {
        isolationLevel: 'serializable',
        readOnly,
      });
    };
  };

  const createHwkCaller = () => {
    return buildHwkFormRouter(baseConfig).createCaller({
      trxFactory: createTrxFactory(),
      token: createToken(),
    });
  };

  const createAnswerCaller = () => {
    return answerRouter.createCaller({
      trxFactory: createTrxFactory(),
      token: createToken(),
    });
  };

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(baseUser);

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(baseProject);

    await postgres
      .knex<FeatureFlag>(STARTUPHAFENBACKEND_TABLES.FEATUREFLAG)
      .insert({
        name: 'hwk',
        enabled: true,
        description: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflict('name')
      .merge({
        enabled: true,
        updatedAt: new Date(),
      });

    await postgres.knex<OzgInfo>(STARTUPHAFENBACKEND_TABLES.OZGINFO).insert({
      id: 1,
      projectId: baseProject.id,
      domain: 'test',
      oeid: 'oeid-1',
      amt: 'Amt',
      amtCode: '123',
      kreis: 'Berlin',
      gemeinde: 'Berlin',
      plz: '12345',
      createdAt: new Date(),
    });

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('still blocks filled pdf generation after progress is manually set to 100 without completed answers', async () => {
    const hwkCaller = createHwkCaller();

    jest
      .spyOn(HwkFormPdfService.prototype, 'generateFilledPdf')
      .mockResolvedValue(new Uint8Array([1, 2, 3]));
    jest
      .spyOn(HwkApplicationPdf, 'mergePdfDocuments')
      .mockResolvedValue(new Uint8Array([9, 9, 9]));

    await expect(hwkCaller.getFilledPdf(baseProject.id)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'Project questionnaire is not finished yet',
    } satisfies Partial<TRPCError>);

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({ progress: 100 });

    await expect(hwkCaller.getFilledPdf(baseProject.id)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    } satisfies Partial<TRPCError>);
  });

  it('keeps blocking HWK submission after a critical answer is changed server-side', async () => {
    const answerCaller = createAnswerCaller();
    const hwkCaller = createHwkCaller();

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({ progress: 100 });

    await postgres.knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS).insert([
      {
        id: 1,
        key: 'Us1',
        projectId: baseProject.id,
        stringValue: null,
        componentId: 'Us1',
        value: 'us1Ans-1',
        type: 'text',
        xmlKey: '/',
        questionText: 'Us1',
        answerText: 'Us1',
        headerText: null,
      },
      {
        id: 2,
        key: 'HwkEntryType',
        projectId: baseProject.id,
        stringValue: 'Handwerksrolle',
        componentId: 'HwkEntryType',
        value: 'hwkEntryAns-1',
        type: 'text',
        xmlKey: '/',
        questionText: 'HwkEntryType',
        answerText: 'HwkEntryType',
        headerText: null,
      },
    ]);

    await postgres
      .knex<QuestionTracking>(STARTUPHAFENBACKEND_TABLES.QUESTIONTRACKING)
      .insert({
        projectId: baseProject.id,
        answeredQuestions: ['Us1', 'HwkEntryType'],
      });

    jest
      .spyOn(HwkFormPdfService.prototype, 'generateFilledPdf')
      .mockResolvedValue(new Uint8Array([1, 2, 3]));
    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    await expect(hwkCaller.sendHwkMail(baseProject.id)).resolves.toMatchObject({
      status: 'failed',
      lastError: 'Das Projekt ist nicht fuer den HWK-Antrag freigeschaltet.',
    });

    await expect(
      answerCaller.update({
        id: 1,
        updates: {
          value: 'us1Ans-2',
        },
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);

    await expect(hwkCaller.sendHwkMail(baseProject.id)).resolves.toMatchObject({
      status: 'failed',
    });
    expect(sendMailSpy).not.toHaveBeenCalled();
  });
});
