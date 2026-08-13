import { isAllowed, ShUser } from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import z from 'zod';
import { ServerConfig } from '../../config';
import { BNTKTool } from './bntk-tool';

export function buildBntkRouter(config: ServerConfig) {
  return router({
    sendToBntk: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: 'bntk',
      })
      .input(
        z.object({
          projectId: z.number(),
        })
      )
      .output(
        z.object({
          success: z.boolean(),
          sdsId: z.string().optional(),
        })
      )
      .query(async (req) => {
        await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(
            trx,
            req.input.projectId,
            req.ctx.token?.sub
          );
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }
        });

        const bntkTool = new BNTKTool(config);

        const user: ShUser = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShUser').where({
            id: req.ctx.token?.sub,
          });
          return res[0];
        });

        const uuid = randomUUID();
        const json = bntkTool.buildJSON(user, uuid);
        const jwt = await bntkTool.generateJWT();

        try {
          const response = await fetch(config.bntk?.domain ?? '', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
              'x-bnotk-tid': uuid,
              'x-bnotk-cid': uuid.substring(0, 13),
              'x-bnotk-uid': 'N/A',
              'x-bnotk-sid': 'N/A',
              'x-bnotk-gid': 'N/A',
            },
            body: JSON.stringify(json),
          });

          if (!response.ok) return { success: false };

          return {
            success: true,
            sdsId: (await response.json()).sdsId.toString(),
          };
        } catch (error) {
          console.error('BNTK send error', error);
          return { success: false };
        }
      }),

    getBntkDomain: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: 'bntk',
      })
      .input(z.void())
      .output(z.object({ domain: z.string() }))
      .query(async () => {
        return {
          domain: config.bntk?.domain.match(/^https?:\/\/[^/]*\.de/)?.[0] ?? '',
        };
      }),
  });
}
