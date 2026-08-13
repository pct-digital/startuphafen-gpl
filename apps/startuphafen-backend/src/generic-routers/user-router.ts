import { shUserSchema } from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { UserDbController } from '../features/common/user-db-controller';

export function buildUserRouter() {
  return router({
    getUser: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .output(shUserSchema.partial())
      .query(async (req) => {
        const user = await req.ctx.trxFactory(async (trx) => {
          const db = new UserDbController(trx);
          const uid = req.ctx.token?.sub;
          if (uid == null) return null;
          return await db.getUserById(uid);
        });

        return {
          academicTitle: user?.academicTitle,
          cellPhoneNumber: user?.cellPhoneNumber,
          city: user?.city,
          country: user?.country,
          dateOfBirth: user?.dateOfBirth,
          email: user?.email,
          firstName: user?.firstName,
          lastName: user?.lastName,
          name: user?.name,
          phoneNumber: user?.phoneNumber,
          postalCode: user?.postalCode,
          street: user?.street,
          title: user?.title,
        };
      }),
    getUserCount: baseProcedure
      .meta({
        requiredRolesAny: ['startuphafen-admin'],
        feature: null,
      })
      .output(z.number())
      .query(async (req) => {
        const userCount = await req.ctx.trxFactory(async (trx) => {
          return new UserDbController(trx).getUserCount();
        });
        return userCount;
      }),
    getUserCreatedRatio: baseProcedure
      .meta({
        requiredRolesAny: ['startuphafen-admin'],
        feature: null,
      })
      .output(
        z.array(
          z.object({
            createdAt: z.string(),
            amount: z.number(),
          })
        )
      )
      .query(async (req) => {
        return await req.ctx.trxFactory(async (trx) => {
          return new UserDbController(trx).getUserCreatedRatio();
        });
      }),
  });
}
