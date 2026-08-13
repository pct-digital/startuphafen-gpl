import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Answers,
  HwkMailLog,
  Project,
  QuestionTracking,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { ConfigSchema, ServerConfig } from '../../config';
import { answerRouter } from '../../generic-routers/answer-router';
import { MailClient } from '../common/mail';
import { HwkMailService } from './hwk-mail-service';

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
  gwSent: true,
  stSent: true,
  lastPosition: 0,
  progress: 100,
  userId: baseUser.id,
};

const config: ServerConfig = ConfigSchema.parse({
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

type AnswerInsert = Omit<Answers, 'id'>;

const buildAnswer = (
  key: string,
  value: string,
  componentId: string,
  stringValue: string | null = null
): AnswerInsert => ({
  key,
  value,
  projectId: baseProject.id,
  componentId,
  stringValue,
  type: 'string',
  xmlKey: '/',
  questionText: key,
  answerText: value,
  headerText: null,
});

describe('HwkMailService', () => {
  const syncAnsweredQuestions = async (keys: string[]) => {
    await postgres
      .knex<QuestionTracking>(STARTUPHAFENBACKEND_TABLES.QUESTIONTRACKING)
      .where({ projectId: baseProject.id })
      .delete();

    await postgres
      .knex<QuestionTracking>(STARTUPHAFENBACKEND_TABLES.QUESTIONTRACKING)
      .insert({
        projectId: baseProject.id,
        answeredQuestions: keys,
      });
  };

  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(async (trx) => await work(trx), {
        isolationLevel: 'serializable',
        readOnly,
      });
    };
  };

  const createAnswerCaller = () => {
    return answerRouter.createCaller({
      trxFactory: createTrxFactory(),
      token: {
        sub: baseUser.id,
        realm_access: {
          roles: ['bundID-high'],
        },
      },
    });
  };

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(baseUser);

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(baseProject);

    await postgres
      .knex<AnswerInsert>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert([
        buildAnswer('Us1', 'us1Ans-2', 'Us1'),
        buildAnswer(
          'HwkEntryType',
          'hwkEntryAns-1',
          'HwkEntryType',
          'Handwerksrolle'
        ),
        buildAnswer('HwkTrade', 'Goldschmied', 'HwkTrade'),
      ]);

    await syncAnsweredQuestions(['Us1', 'HwkEntryType', 'HwkTrade']);

    const now = new Date();
    await postgres
      .knex<HwkMailLog>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .insert({
        projectId: baseProject.id,
        userId: baseUser.id,
        status: 'pending',
        recipient: 'hwk@example.com',
        cc: baseUser.email,
        replyTo: baseUser.email,
        subject: 'HWK-Antrag - Test',
        mailBody: null,
        mailFrom: null,
        mailContentType: null,
        lastError: null,
        attemptCount: 0,
        lastAttemptAt: null,
        nextAttemptAt: new Date(now.getTime() - 60_000),
        sentAt: null,
        createdAt: now,
        updatedAt: now,
        id: 1,
      });

    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert([
        {
          userId: baseUser.id,
          filename: 'qualification-proof.pdf',
          mimeType: 'application/pdf',
          documentCase: 'hwk_qualification_proof',
          data: new Uint8Array([1, 2, 3]),
          projectId: baseProject.id,
        },
        {
          userId: baseUser.id,
          filename: 'hr-extract.pdf',
          mimeType: 'application/pdf',
          documentCase: 'hwk_hr_extract',
          data: new Uint8Array([4, 5, 6]),
          projectId: baseProject.id,
        },
        {
          userId: baseUser.id,
          filename: 'ignored.pdf',
          mimeType: 'application/pdf',
          documentCase: null,
          data: new Uint8Array([7, 8]),
          projectId: baseProject.id,
        },
      ]);

    await fixSequences(postgres.knex);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('sends hwk mail with only active hwk attachments for eun flow', async () => {
    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);

    const mailRequest = sendMailSpy.mock.calls[0][0];
    const attachmentNames =
      mailRequest.attachments?.map((attachment) => attachment.filename) ?? [];

    expect(attachmentNames).toEqual([
      'HWK-Antrag-100.pdf',
      'qualification-proof.pdf',
    ]);
  });

  it('pretends to send hwk mail when delivery is disabled in config', async () => {
    const sendMailSpy = jest.spyOn(MailClient.prototype, 'sendMail');

    const service = new HwkMailService(
      {
        ...config,
        mail: {
          ...config.mail,
          disableHwkDelivery: true,
        },
      },
      createTrxFactory()
    );
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');
    expect(status.lastError).toBe(null);
    expect(sendMailSpy).not.toHaveBeenCalled();
  });

  it('blocks kapg hwk mail when no handelsregisterauszug is uploaded', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({ catalogueId: 'kapg' });

    await postgres
      .knex<AnswerInsert>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert(buildAnswer('HwkBranche', 'us1Ans-2', 'HwkBranche'));
    await syncAnsweredQuestions([
      'Us1',
      'HwkEntryType',
      'HwkTrade',
      'HwkBranche',
    ]);

    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .where({
        userId: baseUser.id,
        projectId: baseProject.id,
        documentCase: 'hwk_hr_extract',
      })
      .delete();

    const sendMailSpy = jest.spyOn(MailClient.prototype, 'sendMail');

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('failed');
    expect(status.lastError).toBe(
      'Für den HWK-Antrag bei Kapitalgesellschaften muss ein Handelsregisterauszug hochgeladen werden.'
    );
    expect(sendMailSpy).not.toHaveBeenCalled();
  });

  it('attaches the handelsregisterauszug for kapg hwk mail', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({ catalogueId: 'kapg' });

    await postgres
      .knex<AnswerInsert>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert(buildAnswer('HwkBranche', 'us1Ans-2', 'HwkBranche'));
    await syncAnsweredQuestions([
      'Us1',
      'HwkEntryType',
      'HwkTrade',
      'HwkBranche',
    ]);

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');

    const mailRequest = sendMailSpy.mock.calls[0][0];
    const attachmentNames =
      mailRequest.attachments?.map((attachment) => attachment.filename) ?? [];

    expect(attachmentNames).toContain('hr-extract.pdf');
  });

  it('includes activity description and ai justification in mail body', async () => {
    await postgres
      .knex<AnswerInsert>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert([
        buildAnswer(
          'HwkAiDescription',
          'Installation und Wartung von Solaranlagen.',
          'HwkAi'
        ),
        buildAnswer(
          'HwkAi',
          JSON.stringify({
            classification: 'Handwerksrolle',
            branch: 'Handwerk',
            requiresPermit: true,
            shortDescription: 'Installation von Solaranlagen',
            trades: ['Elektrotechniker (Anlage A)'],
            reasoning:
              'Die Tätigkeit umfasst wesentliche elektrotechnische Arbeiten und ist daher der Handwerksrolle zuzuordnen.',
          }),
          'HwkAi',
          'Handwerksrolle'
        ),
      ]);
    await syncAnsweredQuestions([
      'Us1',
      'HwkEntryType',
      'HwkTrade',
      'HwkAiDescription',
      'HwkAi',
    ]);

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);

    const mailBody = sendMailSpy.mock.calls[0][0].content.data;
    expect(mailBody).toContain(
      'Tätigkeitsbeschreibung: Installation und Wartung von Solaranlagen.'
    );
    expect(mailBody).toContain('KI-Einordnung:');
    expect(mailBody).toContain('- Klassifikation: Handwerksrolle');
    expect(mailBody).toContain('- Branche: Handwerk');
    expect(mailBody).toContain('- Erlaubnispflicht: Ja');
    expect(mailBody).toContain(
      'KI-Begründung: Die Tätigkeit umfasst wesentliche elektrotechnische Arbeiten und ist daher der Handwerksrolle zuzuordnen.'
    );
  });

  it('returns failed status when tracking list is explicitly empty', async () => {
    await syncAnsweredQuestions([]);

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);
    const log = await postgres
      .knex<HwkMailLog>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .where({ projectId: baseProject.id })
      .first();

    expect(status.status).toBe('failed');
    expect(status.lastError).toBe(
      'Der Fragebogen ist noch nicht abgeschlossen.'
    );
    expect(log?.status).toBe('pending');
    expect(log?.attemptCount).toBe(0);
    expect(sendMailSpy).not.toHaveBeenCalled();
  });
  it('logs failed mail attempts', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation();
    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: false, message: 'mail transport failed' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);
    const log = await postgres
      .knex<HwkMailLog>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .where({ projectId: baseProject.id })
      .first();

    expect(status.status).toBe('failed');
    expect(status.nextAttemptAt).toBeInstanceOf(Date);
    expect(log?.nextAttemptAt).toBeInstanceOf(Date);
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('sends hwk mail even when stSent and gwSent are false', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({
        stSent: false,
        gwSent: false,
      });

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
  });

  it('does not send qualification proof when HwkEntryType is not handwerksrolle', async () => {
    await postgres
      .knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .where({ projectId: baseProject.id, key: 'HwkEntryType' })
      .update({
        value: 'hwkEntryAns-2',
        answerText: 'hwkEntryAns-2',
        stringValue: 'Zulassungsfrei',
      });

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);

    const mailRequest = sendMailSpy.mock.calls[0][0];
    const attachmentNames =
      mailRequest.attachments?.map((attachment) => attachment.filename) ?? [];

    expect(attachmentNames).toEqual(['HWK-Antrag-100.pdf']);
  });

  it('sends hr extract for kapg when St67 indicates trade register entry', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({ catalogueId: 'kapg' });

    await postgres
      .knex<AnswerInsert>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert([
        buildAnswer('HwkBranche', 'us1Ans-2', 'HwkBranche'),
        buildAnswer('St67', 'st67Ans-1', 'St67'),
      ]);
    await syncAnsweredQuestions([
      'Us1',
      'HwkEntryType',
      'HwkTrade',
      'HwkBranche',
      'St67',
    ]);

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);

    const mailRequest = sendMailSpy.mock.calls[0][0];
    const attachmentNames =
      mailRequest.attachments?.map((attachment) => attachment.filename) ?? [];

    expect(attachmentNames).toEqual([
      'HWK-Antrag-100.pdf',
      'qualification-proof.pdf',
      'hr-extract.pdf',
    ]);
  });

  it('sends hr extract for kapg even when St67 is not active', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({ catalogueId: 'kapg' });

    await postgres
      .knex<AnswerInsert>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .insert([
        buildAnswer('HwkBranche', 'us1Ans-2', 'HwkBranche'),
        buildAnswer('St67', 'st67Ans-2', 'St67'),
      ]);
    await syncAnsweredQuestions([
      'Us1',
      'HwkEntryType',
      'HwkTrade',
      'HwkBranche',
      'St67',
    ]);

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('sent');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);

    const mailRequest = sendMailSpy.mock.calls[0][0];
    const attachmentNames =
      mailRequest.attachments?.map((attachment) => attachment.filename) ?? [];

    expect(attachmentNames).toEqual([
      'HWK-Antrag-100.pdf',
      'qualification-proof.pdf',
      'hr-extract.pdf',
    ]);
  });

  it('blocks incomplete projects even if submission flags are manually true', async () => {
    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: baseProject.id })
      .update({
        progress: 10,
        stSent: true,
        gwSent: true,
      });

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const status = await service.queueAndSend(baseProject.id, baseUser.id);

    expect(status.status).toBe('failed');
    expect(status.lastError).toBe(
      'Der Fragebogen ist noch nicht abgeschlossen.'
    );
    expect(sendMailSpy).not.toHaveBeenCalled();
  });

  it('only sends one HWK mail under concurrent queueAndSend calls', async () => {
    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockImplementation(
        async () =>
          await new Promise((resolve) =>
            setTimeout(
              () => resolve({ success: true, message: 'Mail sent' }),
              100
            )
          )
      );

    const service = new HwkMailService(config, createTrxFactory());
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.queueAndSend(baseProject.id, baseUser.id)
      )
    );
    const log = await postgres
      .knex<HwkMailLog>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .where({ projectId: baseProject.id })
      .first();

    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    expect(log?.status).toBe('sent');
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
  });

  it('does not become eligible just because a critical HWK answer was changed later', async () => {
    await postgres
      .knex<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .where({ projectId: baseProject.id, key: 'Us1' })
      .update({
        value: 'us1Ans-1',
        answerText: 'us1Ans-1',
      });

    const sendMailSpy = jest
      .spyOn(MailClient.prototype, 'sendMail')
      .mockResolvedValue({ success: true, message: 'Mail sent' });

    const service = new HwkMailService(config, createTrxFactory());
    const answerCaller = createAnswerCaller();

    await expect(
      service.queueAndSend(baseProject.id, baseUser.id)
    ).resolves.toMatchObject({
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
    });

    await expect(
      service.queueAndSend(baseProject.id, baseUser.id)
    ).resolves.toMatchObject({
      status: 'failed',
    });
    expect(sendMailSpy).not.toHaveBeenCalled();
  });
});
