import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  ChatAuthor,
  ChatMessage,
  ChatSession,
  Project,
  STARTUPHAFEN_ENTITY_SCHEMA,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { TRPCError } from '@trpc/server';
import { Knex } from 'knex';
import {
  ChatbotProjectContext,
  ChatbotService,
  ChatbotUserContext,
} from './chatbot-service';
import { CHAT_HISTORY_LIMITS } from './constants';

const {
  maxMessageLength: MAX_MESSAGE_LENGTH,
  maxTitleLength: MAX_TITLE_LENGTH,
  defaultSessionTitle: DEFAULT_SESSION_TITLE,
  maxSessionsPerUser: MAX_SESSIONS_PER_USER,
} = CHAT_HISTORY_LIMITS;

export class ChatHistoryService {
  constructor(private readonly chatbotService: ChatbotService | null) {}

  async listSessions(
    userId: string,
    TransactionFactory: TransactionFactory
  ): Promise<ChatSession[]> {
    return TransactionFactory(async (trx) => {
      const rows = await trx<ChatSession>(
        STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
      )
        .where({ userId })
        .whereNull('deletedAt')
        .orderBy('updatedAt', 'desc');

      return rows;
    });
  }

  async createSession(
    userId: string,
    title: string | undefined,
    TransactionFactory: TransactionFactory
  ): Promise<ChatSession> {
    const sanitizedTitle = sanitizeTitle(title);

    return TransactionFactory(async (trx) => {
      await this.assertSessionLimit(trx, userId);
      const [row] = await trx<ChatSession>(
        STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
      )
        .insert({
          userId,
          title: sanitizedTitle,
          updatedAt: trx.fn.now(),
        })
        .returning('*');

      return row;
    });
  }

  async renameSession(
    userId: string,
    sessionId: number,
    title: string,
    TransactionFactory: TransactionFactory
  ): Promise<ChatSession> {
    const sanitizedTitle = enforceTitleLength(title);

    return TransactionFactory(async (trx) => {
      const [row] = await trx<ChatSession>(
        STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
      )
        .where({ id: sessionId, userId })
        .whereNull('deletedAt')
        .update(
          {
            title: sanitizedTitle,
            updatedAt: trx.fn.now(),
          },
          '*'
        );

      if (!row) {
        throw notFoundError();
      }

      return row;
    });
  }

  async deleteSession(
    userId: string,
    sessionId: number,
    TransactionFactory: TransactionFactory
  ): Promise<void> {
    await TransactionFactory(async (trx) => {
      const session = await this.assertSessionOwnership(trx, sessionId, userId);

      await trx<ChatMessage>(STARTUPHAFEN_ENTITY_SCHEMA.ChatMessage.table.name)
        .where({ sessionId: session.id })
        .del();

      const updated = await trx<ChatSession>(
        STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
      )
        .where({ id: session.id })
        .whereNull('deletedAt')
        .update({
          deletedAt: trx.fn.now(),
          updatedAt: trx.fn.now(),
        });

      if (updated === 0) {
        throw notFoundError();
      }
    });
  }

  async getMessages(
    userId: string,
    sessionId: number,
    TransactionFactory: TransactionFactory
  ): Promise<ChatMessage[]> {
    return TransactionFactory(async (trx) => {
      await this.assertSessionOwnership(trx, sessionId, userId);
      const rows = await this.fetchMessages(trx, sessionId);
      return rows;
    });
  }

  async sendMessage(
    userId: string,
    input: { sessionId?: number; message: string },
    TransactionFactory: TransactionFactory
  ): Promise<{
    session: ChatSession;
    messages: ChatMessage[];
  }> {
    const trimmedMessage = input.message.trim();
    if (!trimmedMessage) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Message cannot be empty',
      });
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}`,
      });
    }

    const initialState = await TransactionFactory(async (trx) => {
      const session = await this.findOrCreateSession(
        trx,
        input.sessionId,
        userId
      );

      if (session.deletedAt) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Chat session has been deleted',
        });
      }

      await trx<ChatMessage>(
        STARTUPHAFEN_ENTITY_SCHEMA.ChatMessage.table.name
      ).insert({
        sessionId: session.id,
        author: ChatAuthor.human,
        content: trimmedMessage,
      });

      const messages = await this.fetchMessages(trx, session.id);

      const userTableName =
        STARTUPHAFEN_ENTITY_SCHEMA.schema.tables.ShUser.name;
      const user = await trx<ShUser>(userTableName)
        .select('name', 'firstName', 'lastName', 'city', 'country')
        .where({ id: userId })
        .first();

      if (!user) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unable to load user information',
        });
      }

      const projects = await trx<Project>(
        STARTUPHAFEN_ENTITY_SCHEMA.Project.table.name
      )
        .select('name', 'catalogueId', 'progress', 'stSent', 'gwSent')
        .where({ userId })
        .orderBy('id', 'asc');

      return {
        session,
        messages,
        user: this.toChatbotUserContext(user),
        projects: projects.map((project) => this.toChatbotProjectContext(project)),
      };
    });

    const updatedHistory = this.chatbotService
      ? await this.chatbotService.chat(
          initialState.messages,
          initialState.user,
          initialState.projects
        )
      : initialState.messages;
    const fallbackReply = createFallbackAgentReply();
    const agentReply = updatedHistory.at(-1);
    const normalizedAgentContent = agentReply?.content?.trim();
    const agentContent =
      agentReply?.author === ChatAuthor.agent && normalizedAgentContent
        ? normalizedAgentContent
        : fallbackReply.content;

    const finalState = await TransactionFactory(async (trx) => {
      const currentSession = await this.assertSessionOwnership(
        trx,
        initialState.session.id,
        userId
      );

      await trx<ChatMessage>(
        STARTUPHAFEN_ENTITY_SCHEMA.ChatMessage.table.name
      ).insert({
        sessionId: currentSession.id,
        author: ChatAuthor.agent,
        content: agentContent,
      });

      const sessionUpdates: Record<string, unknown> = {
        updatedAt: trx.fn.now(),
      };

      if (shouldAutoRename(currentSession.title)) {
        sessionUpdates['title'] = buildAutoTitle(trimmedMessage);
      }

      const [updatedSession] = await trx<ChatSession>(
        STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
      )
        .where({ id: currentSession.id })
        .whereNull('deletedAt')
        .update(sessionUpdates, '*');

      if (!updatedSession) {
        throw notFoundError();
      }

      const allMessages = await this.fetchMessages(trx, currentSession.id);

      return {
        session: updatedSession,
        messages: allMessages,
      };
    });

    return {
      session: finalState.session,
      messages: finalState.messages,
    };
  }

  private toChatbotUserContext(user: ChatbotUserContext): ChatbotUserContext {
    return {
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      city: user.city,
      country: user.country,
    };
  }

  private toChatbotProjectContext(
    project: ChatbotProjectContext
  ): ChatbotProjectContext {
    return {
      name: project.name,
      catalogueId: project.catalogueId,
      progress: project.progress,
      stSent: project.stSent,
      gwSent: project.gwSent,
    };
  }

  private async findOrCreateSession(
    trx: Knex.Transaction,
    sessionId: number | undefined,
    userId: string
  ): Promise<ChatSession> {
    if (sessionId != null) {
      return this.assertSessionOwnership(trx, sessionId, userId);
    }

    await this.assertSessionLimit(trx, userId);

    const [created] = await trx<ChatSession>(
      STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
    )
      .insert({
        userId,
        title: DEFAULT_SESSION_TITLE,
        updatedAt: trx.fn.now(),
      })
      .returning('*');

    return created;
  }

  private async assertSessionLimit(
    trx: Knex.Transaction,
    userId: string
  ): Promise<void> {
    const result = await trx<ChatSession>(
      STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
    )
      .where({ userId })
      .whereNull('deletedAt')
      .count<{ count: string | number }>('id as count')
      .first();

    const activeSessions = Number(result?.count ?? 0);

    if (Number.isNaN(activeSessions)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to determine chat session count',
      });
    }

    if (activeSessions >= MAX_SESSIONS_PER_USER) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Maximum of ${MAX_SESSIONS_PER_USER} chat sessions reached`,
      });
    }
  }

  private async assertSessionOwnership(
    trx: Knex.Transaction,
    sessionId: number,
    userId: string
  ): Promise<ChatSession> {
    const session = await trx<ChatSession>(
      STARTUPHAFEN_ENTITY_SCHEMA.ChatSession.table.name
    )
      .where({ id: sessionId, userId })
      .whereNull('deletedAt')
      .first();

    if (!session) {
      throw notFoundError();
    }

    return session;
  }

  private async fetchMessages(trx: Knex.Transaction, sessionId: number) {
    return trx<ChatMessage>(STARTUPHAFEN_ENTITY_SCHEMA.ChatMessage.table.name)
      .where({ sessionId })
      .orderBy('createdAt', 'asc');
  }
}

function sanitizeTitle(title: string | undefined) {
  const normalized = title?.trim() ?? '';
  if (!normalized) {
    return DEFAULT_SESSION_TITLE;
  }
  return enforceTitleLength(normalized);
}

function enforceTitleLength(title: string) {
  return title.length > MAX_TITLE_LENGTH
    ? title.slice(0, MAX_TITLE_LENGTH).trimEnd()
    : title;
}

function buildAutoTitle(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return DEFAULT_SESSION_TITLE;
  }
  return normalized.length > MAX_TITLE_LENGTH
    ? `${normalized.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
    : normalized;
}

function shouldAutoRename(currentTitle?: string | null) {
  if (!currentTitle) {
    return true;
  }
  return (
    currentTitle.trim().toLowerCase() === DEFAULT_SESSION_TITLE.toLowerCase()
  );
}

function createFallbackAgentReply(): Pick<
  ChatMessage,
  'author' | 'content' | 'createdAt'
> {
  return {
    author: ChatAuthor.agent,
    content:
      'I am sorry, but I was unable to generate a response. Please try again.',
    createdAt: new Date(),
  };
}

function notFoundError() {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: 'Chat session not found',
  });
}
