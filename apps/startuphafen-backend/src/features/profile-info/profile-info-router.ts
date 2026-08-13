import { profileInfoSchema } from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ProfileInfoDbController } from './profile-info-db-controller';

const profileInfoInputSchema = z.object({
  phoneInternational: z.string().min(1),
  phoneNational: z.string().min(1),
  phoneNumber: z.string().min(1),
  website: z.string().nullable(),
  birthCountry: z.string().min(1),
  birthPlace: z.string().min(1),
});

export function buildProfileInfoRouter() {
  return router({
    create: baseProcedure
      .meta({
        feature: null,
        requiredRolesAny: ['login'],
      })
      .input(profileInfoInputSchema.strict())
      .output(z.void())
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        await req.ctx.trxFactory((trx) => {
          const controller = new ProfileInfoDbController(trx);
          return controller.upsert({ ...req.input, userId });
        });
      }),

    get: baseProcedure
      .meta({
        feature: null,
        requiredRolesAny: ['login'],
      })
      .output(profileInfoSchema.partial())
      .query(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        return req.ctx.trxFactory((trx) => {
          const controller = new ProfileInfoDbController(trx);
          return controller.getByUserId(userId);
        }, true);
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
