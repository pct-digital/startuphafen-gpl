import { isAllowed } from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import z from 'zod';
import { RateLimiter } from '../common/rate-limiter';
import { IdentificationDocumentsDbController } from './identification-documents-db-controller';

export function buildIdentificationDocumentsRouter(uploadLimiter: RateLimiter) {
  return router({
    upload: baseProcedure
      .use(uploadLimiter)
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(
        z.object({
          file: z.instanceof(Uint8Array),
          mimeType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
          fileName: z.string().min(1).max(255),
          taxId: z.string().regex(/^\d{11}$/),
          projectId: z.number().positive(),
        })
      )
      .output(z.void())
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);

        if (req.input.file.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'File is empty',
          });
        }

        if (req.input.file.length > 10 * 1024 * 1024) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'File too large (max. 10MB)',
          });
        }

        return await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, req.input.projectId, userId);
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }

          const controller = new IdentificationDocumentsDbController(trx);

          await controller.upsertByTaxId(userId, req.input);
        });
      }),
    getData: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(
        z.object({
          taxId: z.string().regex(/^\d{11}$/),
          projectId: z.number().positive(),
        })
      )
      .output(
        z
          .object({
            data: z.instanceof(Uint8Array),
            mimeType: z.string(),
            fileName: z.string(),
          })
          .nullable()
      )
      .query(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);

        return await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, req.input.projectId, userId);
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }

          const controller = new IdentificationDocumentsDbController(trx);

          const result = await controller.getData(
            userId,
            req.input.taxId,
            req.input.projectId
          );
          if (result === null) return null;
          return {
            data: new Uint8Array(result.data),
            mimeType: result.mimeType,
            fileName: result.fileName,
          };
        });
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
