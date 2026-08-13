import {
  FeatureFlag,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { TRPCError } from '@trpc/server';
import {
  Feature,
  RouteAnon,
  RouteLogin,
  StandardRequestContext,
} from './context';
import { BundIDAddress } from './entities';
import { redactSecrets } from './errors';
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
      inputLog = `INPUT=[ ${JSON.stringify(opts.rawInput, redactSecrets)} ]`;
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
          outputLog = `OUTPUT=[ ${JSON.stringify(ok.data, redactSecrets)} ]`;
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

export const featureFlagMiddleware = trpcBuilder.middleware(async (opts) => {
  const { ctx, meta } = opts;

  if (!meta?.feature) {
    return opts.next({ ctx });
  }

  const featureFlags = ctx.featureFlags ?? (await loadFeatureFlags(ctx));
  ctx.featureFlags = featureFlags;

  ensureFeatureFlagEnabled(meta.feature, featureFlags);

  return opts.next({ ctx });
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
    console.log(
      `Auth denied on ${opts.path}: required=[${meta.requiredRolesAny}] has=[${hasRoles}]`
    );
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Insufficient permissions',
    });
  }

  return opts.next({
    ctx,
  });
});

const userUpsertCache = {
  lastUpserted: new Map<string, number>(),
  lastCleanup: Date.now(),
  upsertDone: function (userId: string) {
    this.lastUpserted.set(userId, Date.now());
  },
  skipUpsert: function (userId: string): boolean {
    if (Date.now() - this.lastCleanup > 60 * 60 * 1000) {
      for (const [key, value] of this.lastUpserted.entries()) {
        if (Date.now() - value > 60 * 1000) {
          this.lastUpserted.delete(key);
        }
      }
      this.lastCleanup = Date.now();
    }
    if (this.lastUpserted.get(userId) === undefined) return false;
    return Date.now() - this.lastUpserted.get(userId)! < 60 * 1000;
  },
};

export const upsertUserMiddleware = trpcBuilder.middleware(async (opts) => {
  const { ctx } = opts;
  if (ctx.token != null) {
    const token = ctx.token;

    const address: BundIDAddress = token['addressBundID'] ?? {
      locality: '',
      postalCode: '',
      country: '',
      streetAddress: '',
    };

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
      inboxReference: token['inbox_reference'] ?? '',
      createdAt: token['createdAt'] ?? new Date(),
    };

    if (!userUpsertCache.skipUpsert(token.sub)) {
      await ctx.trxFactory(async (trx) => {
        await trx<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
          .insert(user)
          .onConflict('id')
          .merge();
      }, false);

      userUpsertCache.upsertDone(user.id);
    }

    ctx.user = user;
  }

  return opts.next({
    ctx,
  });
});

async function loadFeatureFlags(ctx: StandardRequestContext) {
  return ctx.trxFactory(async (trx) => {
    const rows = await trx<FeatureFlag>(STARTUPHAFENBACKEND_TABLES.FEATUREFLAG)
      .select('name', 'enabled')
      .orderBy('name');

    return rows.reduce<Record<string, boolean>>((acc, flag) => {
      acc[flag.name] = flag.enabled;
      return acc;
    }, {});
  }, true);
}

function ensureFeatureFlagEnabled(
  feature: Feature,
  featureFlags: Record<string, boolean>
) {
  const isActive = featureFlags[feature];

  if (isActive === true) {
    return;
  }

  if (isActive === undefined) {
    console.log(
      `The feature ${feature} is not present. Available features: ${Object.keys(
        featureFlags
      ).join(', ')}`
    );
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ressource could not be found.',
    });
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Ressource is deactivated.',
  });
}
