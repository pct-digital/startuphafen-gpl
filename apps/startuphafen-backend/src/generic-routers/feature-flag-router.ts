import { featureFlagSchema } from '@startuphafen/startuphafen-common';
import {
  baseProcedure,
  resolveAuditActor,
  router,
} from '@startuphafen/trpc-root';
import { z } from 'zod';
import { FeatureFlagDbController } from '../features/common/feature-flag-db-controller';

const publicFeatureFlagSchema = featureFlagSchema.pick({
  name: true,
  enabled: true,
});

const adminFeatureFlagSchema = featureFlagSchema.pick({
  name: true,
  enabled: true,
  description: true,
  updatedAt: true,
  updatedBy: true,
});

export function buildFeatureFlagRouter() {
  return router({
    getFeatureFlags: baseProcedure
      .meta({
        requiredRolesAny: ['anon'],
        feature: null,
      })
      .output(z.array(publicFeatureFlagSchema))
      .query(async (req) => {
        return req.ctx.trxFactory(async (trx) => {
          return new FeatureFlagDbController(trx).getPublicFeatureFlags();
        });
      }),
    getAdminFeatureFlags: baseProcedure
      .meta({
        requiredRolesAny: ['startuphafen-admin'],
        feature: null,
      })
      .output(z.array(adminFeatureFlagSchema))
      .query(async (req) => {
        return req.ctx.trxFactory(async (trx) => {
          return new FeatureFlagDbController(trx).getAdminFeatureFlags();
        });
      }),
    setFeatureFlagState: baseProcedure
      .meta({
        requiredRolesAny: ['startuphafen-admin'],
        feature: null,
        logCalls: 'content',
      })
      .input(featureFlagSchema.pick({ enabled: true, name: true }))
      .output(z.void())
      .mutation(async (req) => {
        await req.ctx.trxFactory(async (trx) => {
          const db = new FeatureFlagDbController(trx);
          const updatedBy = resolveAuditActor(req.ctx);

          const affectedRows = await db.updateFeatureFlagState({
            name: req.input.name,
            enabled: req.input.enabled,
            updatedBy,
          });

          if (affectedRows === 0) {
            throw new Error(
              `Feature flag with name ${req.input.name} does not exist.`
            );
          }
        });
      }),
  });
}
