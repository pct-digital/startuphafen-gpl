import { shUserSchema } from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';

export function buildUserRouter() {
  return router({
    getUser: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
      })
      .output(shUserSchema.partial())
      .query(async (req) => {
        const user = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShUser').where({
            id: req.ctx.token?.sub,
          });
          return res[0];
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
  });
}
