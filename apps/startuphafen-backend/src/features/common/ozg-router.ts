import {
  Answers,
  formatDateToGerman,
  isAllowed,
  OZGResponse,
  ProfileInfo,
  QuestionTracking,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { getAssetPath } from '../../assets-loader';
import { ServerConfig } from '../../config';
import { IdentificationDocumentsDbController } from '../identification-documents/identification-documents-db-controller';
import { OzgInfoDbController } from '../ozg-info/ozg-info-db-controller';
import { UserDocumentDbController } from '../user-documents/user-document-db-controller';
import { FeatureFlagDbController } from './feature-flag-db-controller';
import { OZGTool } from './ozg-tool';

function normalizeDomain(value: string): string | null {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== 'https:') {
      return null;
    }
    if (parsedUrl.username || parsedUrl.password) {
      return null;
    }
    return parsedUrl.origin;
  } catch {
    return null;
  }
}

export function buildOZGRouter(config: ServerConfig) {
  const ozgTool = new OZGTool(config);

  return router({
    postOZGFormData: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-high'],
        feature: null,
      })
      .input(
        z.object({
          projectId: z.number(),
          catalogueId: z.string(),
          domain: z.string().optional(),
        })
      )
      .output(z.union([OZGResponse, z.null()]))
      .mutation(async (req) => {
        console.log('### Start of OZG Request ###');

        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input.projectId, req.ctx.token?.sub);
        });

        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        if (config.ozg.placeholder) {
          let casePdfPath = '';
          switch (req.input.catalogueId) {
            case 'kapg':
              casePdfPath = 'placeholders/KAPG.pdf';
              break;
            case 'eun':
              casePdfPath = 'placeholders/EUN.pdf';
              break;
            default:
              casePdfPath = config.ozg.placeholder;
              break;
          }
          console.log('OZG service using placeholder response:', casePdfPath);
          const pdfBuffer = await readFile(getAssetPath(casePdfPath));
          const placeholderResponse: OZGResponse = {
            transactionId: 'placeholder-transaction-id',
            vorgang: {
              vorgangId: 'placeholder-vorgang-id',
              vorgangNummer: 'PLACEHOLDER-001',
              status: 'ERFOLGREICH',
              statusSince: new Date().toISOString(),
            },
            documentBlob: pdfBuffer.toString('base64'),
          };
          await req.ctx.trxFactory(async (trx) => {
            console.log('### Updating Project Status GW ###');
            return await trx('Project')
              .where({ id: req.input.projectId })
              .update({ gwSent: true });
          });
          console.log('### End of OZG Request (placeholder) ###');
          return placeholderResponse;
        }

        const user: ShUser = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShUser').where({
            id: req.ctx.token?.sub,
          });
          return res[0];
        });

        const profileInfo: ProfileInfo | null = await req.ctx.trxFactory(
          async (trx) => {
            const res = await trx('ProfileInfo').where({
              userId: req.ctx.token?.sub,
            });
            if (res.length === 0) return null;
            return res[0];
          }
        );

        if (profileInfo === null) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No profile info found for user',
          });
        }

        console.log(`> Sending OZG-application for ${user.id}`);

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

        let builtJSON = null;

        const projectData = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('Project').select('name').where({
            id: req.input.projectId,
          });

          return {
            projectTitle: res[0].name as string,
          };
        });
        const projectTitle = projectData.projectTitle;

        const globalOverride =
          config.ozg.globalOverride == null
            ? null
            : await req.ctx.trxFactory(async (trx) => {
                const featureFlagDbController = new FeatureFlagDbController(
                  trx
                );
                const row = await featureFlagDbController.getByName(
                  'ozg_global_override'
                );

                if (!row) {
                  throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Resource could not be found.',
                  });
                }

                return row.enabled ? config.ozg.globalOverride : null;
              });

        const { validatedDomainOverride, validatedOeidOverride } =
          globalOverride != null
            ? {
                validatedDomainOverride: globalOverride.domain,
                validatedOeidOverride: globalOverride.oeid,
              }
            : await req.ctx.trxFactory(async (trx) => {
                const requestedDomain = req.input.domain;
                if (requestedDomain == null) {
                  return {
                    validatedDomainOverride: undefined,
                    validatedOeidOverride: undefined,
                  };
                }

                const normalizedRequestedDomain =
                  normalizeDomain(requestedDomain);
                if (normalizedRequestedDomain == null) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Invalid OZG domain override',
                  });
                }

                const ozgInfoController = new OzgInfoDbController(trx);
                const ozgInfoEntries = await ozgInfoController.getByProjectId(
                  req.input.projectId
                );

                const allowedDomains = new Set(
                  ozgInfoEntries
                    .map((entry) => normalizeDomain(entry.domain))
                    .filter((domain): domain is string => domain != null)
                );

                if (!allowedDomains.has(normalizedRequestedDomain)) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Unauthorized OZG domain override',
                  });
                }

                const validatedOeidOverride =
                  ozgInfoEntries.find(
                    (entry) =>
                      normalizeDomain(entry.domain) ===
                      normalizedRequestedDomain
                  )?.oeid ?? undefined;

                return {
                  validatedDomainOverride: normalizedRequestedDomain,
                  validatedOeidOverride,
                };
              });

        if (
          validatedOeidOverride === undefined &&
          validatedDomainOverride !== undefined
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No OEID found for the provided domain',
          });
        }


        switch (req.input.catalogueId) {
          case 'eun':
            builtJSON = ozgTool.buildEUnJSON(
              user,
              profileInfo,
              filtered,
              config,
              req.ctx.rawToken ?? 'NO TOKEN',
              req.input.catalogueId,
              projectTitle,
              validatedOeidOverride
            );
            break;
          case 'kapg':
            builtJSON = ozgTool.buildKapGJSON(
              user,
              profileInfo,
              filtered,
              config,
              req.ctx.rawToken ?? 'NO TOKEN',
              req.input.catalogueId,
              projectTitle,
              validatedOeidOverride
            );
            break;
          default:
            return null;
        }

        if (builtJSON == null) return null;

        const ozgDocBuffer = ozgTool.createDocument(
          builtJSON.formDataInput,
          req.input.catalogueId
        );
        const base64Document =
          ozgDocBuffer == null
            ? ''
            : Buffer.from(ozgDocBuffer).toString('base64');
        const ozgDocBlob =
          ozgDocBuffer !== null
            ? new Blob([ozgDocBuffer], {
                type: 'application/pdf',
              })
            : null;

        const identificationAttachments: File[] = [];
        const documentNamePrefix = 'Ausweis-SteuerID-';

        if (req.input.catalogueId === 'kapg') {
          const shareholderAnswers = filtered.filter((answer) =>
            answer.key.startsWith('St82o_')
          );
          // The logged-in applicant is always the first shareholder row
          // (index 0), whose identity is already verified via BundID. We must
          // exempt exactly that row - not the lowest existing St82o_ answer -
          // because a Firma at index 0 has no St82o_ answer, which would
          // otherwise wrongly exempt a valid natural person at a higher index.
          const applicantKey =
            req.input.catalogueId === 'kapg' ? 'St82o_0' : null;
          const requiredShareholderAnswers = shareholderAnswers.filter(
            (answer) => answer.key !== applicantKey
          );

          await req.ctx.trxFactory(async (trx) => {
            const idDocController = new IdentificationDocumentsDbController(
              trx
            );

            const requiredTaxIds = new Set(
              requiredShareholderAnswers.map(
                (answer) => answer.stringValue ?? answer.value
              )
            );

            const allIdDocs = await idDocController.getByProject(
              req.input.projectId
            );
            const idDocs = allIdDocs.filter((doc) =>
              requiredTaxIds.has(doc.taxId)
            );

            for (const idDoc of idDocs) {
              const file = new File(
                [new Uint8Array(idDoc.data)],
                `${documentNamePrefix}${idDoc.taxId}.${
                  idDoc.mimeType.split('/')[1]
                }`,
                {
                  type: idDoc.mimeType,
                }
              );
              identificationAttachments.push(file);
            }
          });

          for (const answer of requiredShareholderAnswers) {
            const taxId =
              answer.stringValue == null ? answer.value : answer.stringValue;
            if (
              identificationAttachments.findIndex((file) =>
                file.name.startsWith(`${documentNamePrefix}${taxId}`)
              ) !== -1
            ) {
              continue;
            }
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Missing identification document for a tax ID`,
            });
          }
        }

        const res: OZGResponse = await ozgTool.postOZGFormData(
          builtJSON.formDataBuild,
          ozgDocBlob,
          identificationAttachments,
          builtJSON.attachments,
          validatedDomainOverride,
          validatedOeidOverride
        );

        const returnRes: OZGResponse = { ...res, documentBlob: base64Document };

        if (res.errorMessage == null) {
          await req.ctx.trxFactory(async (trx) => {
            if (req.input.catalogueId === 'kapg') {
              const idDocController = new IdentificationDocumentsDbController(
                trx
              );
              await idDocController.deleteForProject(req.input.projectId);
              if (req.ctx.token?.sub) {
                await idDocController.deleteDocumentsWithoutProjectForUser(
                  req.ctx.token.sub
                );
              }
            }
            console.log('### Updating Project Status GW ###');
            return await trx('Project')
              .where({ id: req.input.projectId })
              .update({ gwSent: true });
          });
        }
        if (ozgDocBuffer != null) {
          const pdfData = ozgDocBuffer;
          await req.ctx.trxFactory(async (trx) => {
            const docController = new UserDocumentDbController(trx);
            await docController.upload(user.id, {
              file: pdfData,
              filename: `Gewerbeanmeldung_${formatDateToGerman(new Date())}`,
              mimeType: 'application/pdf',
              projectId: req.input.projectId,
            });
          });
        }

        console.log('### End of OZG Request ###');
        return returnRes;
      }),
  });
}
