import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  ChatAuthor,
  ChatMessage,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { TRPCError } from '@trpc/server';
import { Knex } from 'knex';
import { ChatHistoryService } from './chat-history-service';
import { ChatbotService } from './chatbot-service';
import { CHAT_HISTORY_LIMITS } from './constants';

const postgres = new DockerizedPostgres();

jest.setTimeout(600000);

const CHAT_SESSION_TABLE = STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name;
const CHAT_MESSAGE_TABLE = STARTUPHAFEN_ENTITY_SCHEMA.ChatMessage.table.name;
const SH_USER_TABLE = STARTUPHAFEN_ENTITY_SCHEMA.schema.tables.ShUser.name;
const PROJECT_TABLE = STARTUPHAFEN_ENTITY_SCHEMA.Project.table.name;

async function createSchema(knex: Knex) {
  await knex.schema.createTable(SH_USER_TABLE, (table) => {
    table.string('id').primary();
    table.string('name').nullable();
    table.specificType('roles', 'text[]').nullable();
    table.string('academicTitle').nullable();
    table.string('title').nullable();
    table.string('firstName').notNullable();
    table.string('lastName').notNullable();
    table.string('email').notNullable();
    table.string('phoneNumber').notNullable();
    table.string('cellPhoneNumber').notNullable();
    table.string('dateOfBirth').notNullable();
    table.string('street').notNullable();
    table.string('postalCode').notNullable();
    table.string('city').notNullable();
    table.string('country').notNullable();
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable(PROJECT_TABLE, (table) => {
    table.increments('id').primary();
    table.string('userId').notNullable();
    table.string('name').notNullable();
    table.string('catalogueId').notNullable();
    table.integer('progress').notNullable().defaultTo(0);
    table.boolean('stSent').notNullable().defaultTo(false);
    table.boolean('gwSent').notNullable().defaultTo(false);
    table.integer('lastPosition');
  });

  await knex.schema.createTable(CHAT_SESSION_TABLE, (table) => {
    table.increments('id').primary();
    table.string('userId').notNullable();
    table.string('title').notNullable();
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deletedAt').nullable();
  });

  await knex.schema.createTable(CHAT_MESSAGE_TABLE, (table) => {
    table.increments('id').primary();
    table
      .integer('sessionId')
      .notNullable()
      .references('id')
      .inTable(CHAT_SESSION_TABLE)
      .onDelete('CASCADE');
    table.string('author').notNullable();
    table.text('content').notNullable();
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
  });
}

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;
  let chatbotService: jest.Mocked<ChatbotService>;
  let trxFactory: TransactionFactory;

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    chatbotService = {
      chat: jest.fn(
        async (history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[]) => [
          ...history,
          {
            author: ChatAuthor.agent,
            content: 'Antwort des KI Assistenten',
            createdAt: new Date(),
          },
        ]
      ),
    } as unknown as jest.Mocked<ChatbotService>;

    service = new ChatHistoryService(chatbotService);
    trxFactory = <T>(operation: (trx: Knex.Transaction) => Promise<T>) =>
      postgres.knex.transaction(operation);

    await postgres.clearDatabase();
    await createSchema(postgres.knex);
    await postgres.knex(SH_USER_TABLE).insert({
      id: 'user-1',
      name: 'Max Mustermann',
      roles: ['login'],
      academicTitle: null,
      title: null,
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.com',
      phoneNumber: '+491234567890',
      cellPhoneNumber: '+491234567890',
      dateOfBirth: '1990-01-01',
      street: 'Hauptstrasse 1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'Deutschland',
    });
    await postgres.knex(PROJECT_TABLE).insert([
      {
        id: 1,
        userId: 'user-1',
        name: 'Business Plan',
        catalogueId: 'eun',
        progress: 50,
        stSent: false,
        gwSent: true,
        lastPosition: 1,
      },
    ]);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('creates a new session with default title when none provided', async () => {
    const session = await service.createSession(
      'user-1',
      undefined,
      trxFactory
    );

    expect(session.title).toBe(CHAT_HISTORY_LIMITS.defaultSessionTitle);

    const rows = await postgres.knex(CHAT_SESSION_TABLE).select();
    expect(rows).toHaveLength(1);
  });

  it('prevents creating more than the allowed number of sessions', async () => {
    const limit = CHAT_HISTORY_LIMITS.maxSessionsPerUser;

    for (let i = 0; i < limit; i++) {
      await service.createSession('user-1', `Chat ${i + 1}`, trxFactory);
    }

    await expect(
      service.createSession('user-1', 'Overflow chat', trxFactory)
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: `Maximum of ${limit} chat sessions reached`,
    });
  });

  it('lists only active sessions ordered by update time', async () => {
    const first = await service.createSession(
      'user-1',
      'Erster Chat',
      trxFactory
    );
    await service.createSession('user-1', 'Zweiter Chat', trxFactory);
    await service.deleteSession('user-1', first.id, trxFactory);

    const sessions = await service.listSessions('user-1', trxFactory);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].deletedAt).toBeNull();
    expect(sessions[0].title).toBe('Zweiter Chat');
  });

  it('renames a session and enforces title length', async () => {
    const session = await service.createSession(
      'user-1',
      'Alter Name',
      trxFactory
    );
    const longTitle = 'L'.repeat(CHAT_HISTORY_LIMITS.maxTitleLength + 20);

    const renamed = await service.renameSession(
      'user-1',
      session.id,
      longTitle,
      trxFactory
    );

    expect(renamed.title.length).toBe(CHAT_HISTORY_LIMITS.maxTitleLength);
  });

  it('returns persisted messages for a session', async () => {
    const session = await service.createSession('user-1', 'Chat', trxFactory);

    await service.sendMessage(
      'user-1',
      { sessionId: session.id, message: 'Hallo' },
      trxFactory
    );

    const messages = await service.getMessages(
      'user-1',
      session.id,
      trxFactory
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].author).toBe(ChatAuthor.human);
    expect(messages[1].author).toBe(ChatAuthor.agent);
  });

  it('creates a session on demand when sending first message', async () => {
    const result = await service.sendMessage(
      'user-1',
      { message: 'Erste Frage' },
      trxFactory
    );

    expect(result.session.title).toContain('Erste Frage'.slice(0, 10));
    expect(result.messages).toHaveLength(2);
  });

  it('rejects creating a session on demand when the limit is reached', async () => {
    const limit = CHAT_HISTORY_LIMITS.maxSessionsPerUser;

    for (let i = 0; i < limit; i++) {
      await service.createSession('user-1', `Chat ${i + 1}`, trxFactory);
    }

    await expect(
      service.sendMessage('user-1', { message: 'Neue Frage' }, trxFactory)
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: `Maximum of ${limit} chat sessions reached`,
    });
  });

  it('passes minimized user and project context to the chatbot when sending messages', async () => {
    await service.sendMessage('user-1', { message: 'Hallo' }, trxFactory);

    expect(chatbotService.chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        name: 'Max Mustermann',
        city: 'Berlin',
        country: 'Deutschland',
      }),
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Business Plan',
          catalogueId: 'eun',
          progress: 50,
          stSent: false,
          gwSent: true,
        }),
      ])
    );
  });

  it('passes only minimized fields and excludes sensitive or internal metadata', async () => {
    await service.sendMessage('user-1', { message: 'Hallo' }, trxFactory);

    const userContext = chatbotService.chat.mock.calls[0]?.[1];
    const projectContext = chatbotService.chat.mock.calls[0]?.[2]?.[0];

    expect(userContext).toEqual({
      name: 'Max Mustermann',
      firstName: 'Max',
      lastName: 'Mustermann',
      city: 'Berlin',
      country: 'Deutschland',
    });
    expect(userContext).not.toHaveProperty('id');
    expect(userContext).not.toHaveProperty('email');
    expect(userContext).not.toHaveProperty('roles');
    expect(projectContext).toEqual({
      name: 'Business Plan',
      catalogueId: 'eun',
      progress: 50,
      stSent: false,
      gwSent: true,
    });
    expect(projectContext).not.toHaveProperty('id');
    expect(projectContext).not.toHaveProperty('userId');
    expect(projectContext).not.toHaveProperty('lastPosition');
  });

  it('throws an error when sending an empty message', async () => {
    await expect(
      service.sendMessage('user-1', { message: '   ' }, trxFactory)
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('removes all messages when deleting a session but keeps the session soft-deleted', async () => {
    const { session: created } = await service.sendMessage(
      'user-1',
      { message: 'Hallo' },
      trxFactory
    );

    await service.deleteSession('user-1', created.id, trxFactory);

    const sessionRow = await postgres
      .knex(CHAT_SESSION_TABLE)
      .where({ id: created.id })
      .first();
    const messages = await postgres
      .knex(CHAT_MESSAGE_TABLE)
      .where({ sessionId: created.id });

    expect(sessionRow?.deletedAt).not.toBeNull();
    expect(messages).toHaveLength(0);
  });

  it('does not append an agent reply if the session gets deleted before the second transaction', async () => {
    const session = await service.createSession('user-1', 'Chat', trxFactory);

    chatbotService.chat.mockImplementation(async (history) => {
      await service.deleteSession('user-1', session.id, trxFactory);
      return [
        ...history,
        {
          author: ChatAuthor.agent,
          content: 'Antwort des KI Assistenten',
          createdAt: new Date(),
        },
      ];
    });

    await expect(
      service.sendMessage(
        'user-1',
        { sessionId: session.id, message: 'Hallo' },
        trxFactory
      )
    ).rejects.toBeInstanceOf(TRPCError);

    const messages = await postgres
      .knex(CHAT_MESSAGE_TABLE)
      .where({ sessionId: session.id });

    expect(messages).toHaveLength(0);
  });
});
