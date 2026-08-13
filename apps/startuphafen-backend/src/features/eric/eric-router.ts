import {
  Answers,
  CHECKLIST_DOCUMENTS,
  EricRes,
  formatDateToGerman,
  isAllowed,
  QuestionTracking,
  ShUser,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { readFile } from 'fs/promises';
import { z } from 'zod';
import { getAssetPath } from '../../assets-loader';
import { ServerConfig } from '../../config';
import {
  ProfileInfoDbController,
  ProfileInfoResult,
} from '../profile-info/profile-info-db-controller';
import { UserDocumentDbController } from '../user-documents/user-document-db-controller';
import { EUnXMLBuilder } from '../xml-builder/eun-xml-builder';
import { KapGXMLBuilder } from '../xml-builder/kapg-xml-builder';
import { EricTool } from './eric-tool';

export function buildEricRouter(serverConfig: ServerConfig) {
  const ericTool = new EricTool(serverConfig);

  const eunXMLBuilder = new EUnXMLBuilder(serverConfig);
  const kapgXMLBuilder = new KapGXMLBuilder(serverConfig);

  return router({
    xmlPost: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-high'],
        feature: null,
      })
      .input(
        z.object({
          projectId: z.number(),
          catalogueId: z.string(),
          bufaNr: z.number(),
        })
      )
      .output(z.union([EricRes, z.null()]))
      .query(async (req) => {
        console.log('### Start of ERiC Request ###');

        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input.projectId, req.ctx.token?.sub);
        });

        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        if (serverConfig.eric.placeholder) {
          console.log(
            'ERiC service using placeholder response:',
            serverConfig.eric.placeholder
          );
          const pdfBuffer = await readFile(
            getAssetPath(serverConfig.eric.placeholder)
          );
          const placeholderResponse: EricRes = {
            msg: 'ERIC_OK - Placeholder response',
            pdf: {
              type: 'Uint8Array',
              data: Uint8Array.from(pdfBuffer),
            },
            ericResponse: {
              ericCode: 0,
              ericMessage: 'Placeholder - no real ERiC call made',
            },
          };
          await req.ctx.trxFactory(async (trx) => {
            console.log('### Updating Project Status ST ###');
            return await trx('Project')
              .where({ id: req.input.projectId })
              .update({ stSent: true });
          });
          console.log('### End of ERiC Request (placeholder) ###');
          return placeholderResponse;
        }

        const user: ShUser = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShUser').where({
            id: req.ctx.token?.sub,
          });
          return res[0];
        });

        console.log(`> Sending Request for ${user.id}`);

        const tracking: string[] = await req.ctx.trxFactory(async (trx) => {
          const res: QuestionTracking[] = await trx('QuestionTracking').where({
            projectId: req.input.projectId,
          });
          const arr = res[0].answeredQuestions ?? [];
          return arr;
        });

        const dbAnswers: Answers[] = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('Answers').where({
            projectId: req.input.projectId,
          });
          return res;
        });

        const filtered = dbAnswers.filter((e) => tracking.includes(e.key));

        let resXML = null;
        let elsterProcedureVersion = '';
        switch (req.input.catalogueId) {
          case 'kapg': {
            const profileInfo: ProfileInfoResult = await req.ctx.trxFactory(
              async (trx) => {
                const pinfDBController = new ProfileInfoDbController(trx);
                const res = await pinfDBController.getByUserId(user.id);
                return res;
              }
            );

            const attachments: UserDocument[] = await req.ctx.trxFactory(
              async (trx) => {
                const res: UserDocument[] = await trx('UserDocument').where({
                  projectId: req.input.projectId,
                });
                return res.filter(
                  (e) =>
                    e.filename.includes(CHECKLIST_DOCUMENTS.GS_CONTRACT) ||
                    e.filename.includes(CHECKLIST_DOCUMENTS.SH_CONTRACT)
                );
              }
            );
            elsterProcedureVersion = 'ElsterFSE_KapG_202401';
            resXML = await kapgXMLBuilder.buildXML(
              filtered,
              attachments,
              user,
              req.input.bufaNr,
              profileInfo
            );
            break;
          }
          case 'eun': {
            elsterProcedureVersion = 'ElsterFSE_EUn_202401';
            resXML = await eunXMLBuilder.buildXML(
              filtered,
              user,
              req.input.bufaNr
            );
            break;
          }
          default:
            throw new Error('### CatalogueId is not viable! Aborting Send ###');
        }

        if (resXML == null) {
          console.log('### XML-Builder returned no XML. Aborting. ###');
          return null;
        }

        const res: EricRes = await ericTool.makeEricCall({
          xmlData: resXML,
          processFlags: ['ERIC_VALIDIERE', 'ERIC_SENDE', 'ERIC_DRUCKE'],
          elsterProcedureVersion: elsterProcedureVersion,
          ericPrintParam: { duplexPrint: 0, footTxt: '', preview: 0 },
        });

        if (res.pdf != null) {
          const pdfData = normalizeBinaryData(res.pdf.data);
          if (res.msg.includes('ERIC_OK')) {
            await req.ctx.trxFactory(async (trx) => {
              console.log('### Updating Project Status ST ###');
              return await trx('Project')
                .where({ id: req.input.projectId })
                .update({ stSent: true });
            });

            await req.ctx.trxFactory(async (trx) => {
              const docController = new UserDocumentDbController(trx);
              await docController.upload(user.id, {
                file: pdfData,
                filename: `Steuerliche_Erfassung_${formatDateToGerman(
                  new Date()
                )}`,
                mimeType: 'application/pdf',
                projectId: req.input.projectId,
              });
            });
          }
          console.log('### End of ERiC Request ###');
          return {
            ...res,
            pdf: { type: 'Uint8Array', data: Uint8Array.from(pdfData) },
          };
        }

        console.log('### End of ERiC Request ###');
        return res;
      }),
  });
}

function normalizeBinaryData(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data);
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'data' in data
  ) {
    const maybeBuffer = data as { type?: unknown; data?: unknown };
    if (maybeBuffer.type === 'Buffer' && Array.isArray(maybeBuffer.data)) {
      return Uint8Array.from(maybeBuffer.data);
    }
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Could not normalize ERiC PDF data',
  });
}
