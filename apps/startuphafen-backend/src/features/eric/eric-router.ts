import {
  EricRes,
  isAllowed,
  ShAnswers,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { LocalSecrets, ServerConfig } from '../../config';
import { XMLBuilderTool } from '../common/xml-builder';
import { EricTool } from './eric-tool';

export function buildEricRouter(
  serverConfig: ServerConfig,
  localSecrets: LocalSecrets
) {
  const ericTool = new EricTool(serverConfig, localSecrets);
  const xmlBuilderTool = new XMLBuilderTool(localSecrets, serverConfig);

  return router({
    xmlPost: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-high'],
      })
      .input(z.number())
      .output(z.union([EricRes, z.null()]))
      .query(async (req) => {
        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input, req.ctx.token?.sub);
        });

        if (!allowed) return null;

        const user: ShUser = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShUser').where({
            id: req.ctx.token?.sub,
          });
          return res[0];
        });

        const tracking: string[] = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShQuestionTracking').where({
            projectId: req.input,
          });
          const arr = res.map((e) => e.strapiQuestionId);
          return arr;
        });

        const dbAnswers: ShAnswers[] = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShAnswers').where({ projectId: req.input });
          return res;
        });

        const filtered = dbAnswers.filter((e) => tracking.includes(e.key));

        const resXML = await xmlBuilderTool.buildXML(filtered, user);

        if (resXML == null) return null;

        const res: EricRes = await ericTool.makeEricCall({
          xmlData: resXML,
          processFlags: ['ERIC_VALIDIERE', 'ERIC_SENDE', 'ERIC_DRUCKE'],
          elsterProcedureVersion: 'ElsterFSE_EUn_202301',
          ericPrintParam: { duplexPrint: 0, footTxt: '', preview: 0 },
        });

        if (res.pdf != null) {
          return {
            ...res,
            pdf: { type: 'Uint8Array', data: Uint8Array.from(res.pdf.data) },
          };
        }

        return res;
      }),
  });
}
