import {
  chatMessageSchema,
  chatSessionSchema,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ServerConfig } from '../../config';
import { RateLimiter } from '../common/rate-limiter';
import { VectorStoreService } from '../common/vector-store';
import { ChatHistoryService } from './chat-history-service';
import { ChatbotService } from './chatbot-service';
import { CHAT_HISTORY_LIMITS, DEFAULT_TOP_K_RESULTS } from './constants';

const {
  maxTitleLength: MAX_TITLE_LENGTH,
  maxMessageLength: MAX_MESSAGE_LENGTH,
} = CHAT_HISTORY_LIMITS;

export function buildChatbotRouter(
  serverConfig: ServerConfig,
  chatLimiter: RateLimiter
) {
  const vectorStoreService = serverConfig.mistral
    ? new VectorStoreService(
        serverConfig.mistral.apiKey,
        serverConfig.knex.connection
      )
    : null;

  const chatbotService = serverConfig.mistral
    ? new ChatbotService(
        serverConfig.mistral.apiKey,
        vectorStoreService!,
        DEFAULT_TOP_K_RESULTS
      )
    : null;

  if (!serverConfig.mistral) {
    console.warn('Warning, no mistral api key is set, chat will not work');
  }

  const chatHistoryService = new ChatHistoryService(chatbotService);

  return router({
    listSessions: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: 'chat',
      })
      .output(z.array(chatSessionSchema.strict()))
      .query(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        return chatHistoryService.listSessions(userId, req.ctx.trxFactory);
      }),

    createSession: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: 'chat',
      })
      .input(
        z
          .object({
            title: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
          })
          .optional()
      )
      .output(chatSessionSchema.strict())
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        return chatHistoryService.createSession(
          userId,
          req.input?.title,
          req.ctx.trxFactory
        );
      }),

    renameSession: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: 'chat',
      })
      .input(
        z.object({
          sessionId: z.number().int().positive(),
          title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
        })
      )
      .output(chatSessionSchema.strict())
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        return chatHistoryService.renameSession(
          userId,
          req.input.sessionId,
          req.input.title,
          req.ctx.trxFactory
        );
      }),

    deleteSession: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: 'chat',
      })
      .input(
        z.object({
          sessionId: z.number().int().positive(),
        })
      )
      .output(z.void())
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        await chatHistoryService.deleteSession(
          userId,
          req.input.sessionId,
          req.ctx.trxFactory
        );
      }),

    getMessages: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: 'chat',
      })
      .input(
        z.object({
          sessionId: z.number().int().positive(),
        })
      )
      .output(z.array(chatMessageSchema.strict()))
      .query(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        return chatHistoryService.getMessages(
          userId,
          req.input.sessionId,
          req.ctx.trxFactory
        );
      }),

    sendMessage: baseProcedure
      .use(chatLimiter)
      .meta({
        requiredRolesAny: ['login'],
        feature: 'chat',
      })
      .input(
        z.object({
          sessionId: z.number().int().positive().optional(),
          message: z
            .string()
            .trim()
            .min(1, 'Message cannot be empty')
            .max(MAX_MESSAGE_LENGTH),
        })
      )
      .output(
        z
          .object({
            session: chatSessionSchema,
            messages: z.array(chatMessageSchema),
          })
          .strict()
      )
      .mutation(async (req) => {
        if (!serverConfig.mistral) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'API Key not configured',
          });
        }
        const userId = requireUserId(req.ctx.token?.sub);
        return chatHistoryService.sendMessage(
          userId,
          req.input,
          req.ctx.trxFactory
        );
      }),
  });
}

function requireUserId(userId?: string | null) {
  if (!userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User authentication required',
    });
  }
  return userId;
}
