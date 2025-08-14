import {
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { TRPCError } from '@trpc/server';
import { RouteAnon, RouteLogin } from './context';
import { BundIDAddress } from './entities';
import { trpcBuilder } from './init';

export const longCallsLoggerMiddleware = trpcBuilder.middleware(async (req) => {
  const startTime = Date.now();
  const resp = await req.next({ ctx: req.ctx });
  const finishTime = Date.now();

  const requestTime = finishTime - startTime;
  if (requestTime > 5000) {
    console.log(
      `WARN ${req.type} /${req.path} took very long: ${requestTime} ms`
    );
  }

  return resp;
});

let callIdSource = 1;

export const loggingMiddleware = trpcBuilder.middleware((opts) => {
  const { ctx, meta } = opts;

  const startTime = Date.now();

  let callID = '';

  const doLog = meta?.logCalls === 'audit' || meta?.logCalls === 'content';

  if (doLog) {
    callID = callIdSource++ + '';

    let inputLog = '';
    if (meta?.logCalls === 'content') {
      inputLog = `INPUT=[ ${JSON.stringify(opts.rawInput)} ]`;
    }

    console.log(
      `<${callID}> [ ${opts.type} ${opts.path} ] CALLER=[ ${opts.ctx.token?.sub}, ${opts.ctx.user?.name} ] ${inputLog}`
    );
  }

  const result = opts.next({
    ctx,
  });

  return result.then(
    (ok: any) => {
      if (doLog) {
        let outputLog = '';
        if (meta?.logCalls === 'content') {
          outputLog = `OUTPUT=[ ${JSON.stringify(ok.data)} ]`;
        }

        console.log(
          `<${callID}> [OK] [ ${opts.type} ${opts.path} ] [ ${
            Date.now() - startTime
          }ms ]${outputLog}`
        );
      }

      return ok;
    },
    (err) => {
      if (doLog) {
        console.log(
          `<${callID}> [ER] [ ${opts.type} ${opts.path} ] [ ${
            Date.now() - startTime
          }ms ] errors!!!`,
          err
        );
      }

      return err;
    }
  );
});

export const authMiddleware = trpcBuilder.middleware((opts) => {
  const { ctx, meta } = opts;
  if (meta == null) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'You need to specify meta auth role requirements on ' + opts.path,
    });
  }

  const hasRoles = ctx.token?.realm_access.roles ?? [];
  if (ctx.token && ctx.token?.sub) {
    hasRoles.push(RouteLogin);
  }
  hasRoles.push(RouteAnon);

  if (!hasRoles.some((hasRole) => meta.requiredRolesAny.includes(hasRole))) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message:
        'You do not have the roles required to make this call to ' +
        opts.path +
        ', you would need any of these roles: ' +
        meta.requiredRolesAny.join(',') +
        ' but you only have: ' +
        hasRoles.join(', '),
    });
  }

  return opts.next({
    ctx,
  });
});

export const upsertUserMiddleware = trpcBuilder.middleware(async (opts) => {
  const { ctx } = opts;
  if (ctx.token != null) {
    const token = ctx.token;

    const address: BundIDAddress = token['addressBundID'];

    const user: ShUser = {
      id: token.sub,
      name: token.name ?? null,
      roles: token.realm_access.roles,
      city: address['locality'] ?? '',
      postalCode: address['postalCode'] ?? '',
      country: address['country'] ?? '',
      street: address['streetAddress'] ?? '',
      academicTitle: token['academicTitleBundID'] ?? null,
      title: token['personalTitleBundID'] ?? null,
      dateOfBirth: token['dateOfBirthBundID'] ?? '',
      firstName: token['firstNameBundID'] ?? '',
      lastName: token['lastNameBundID'] ?? '',
      phoneNumber: token['phoneNumberBundID'] ?? '',
      cellPhoneNumber: token['cellphoneNumberBundID'] ?? '',
      email: token['email'] ?? '',
    };

    await ctx.trxFactory(async (trx) => {
      await trx<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(user)
        .onConflict('id')
        .merge();
    }, false);

    ctx.user = user;
  }

  return opts.next({
    ctx,
  });
});
