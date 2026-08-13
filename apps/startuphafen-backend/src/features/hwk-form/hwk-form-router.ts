import {
  Answers,
  HwkFormDataSchema,
  HwkMailStatusSchema,
  isAllowed,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { Knex } from 'knex';
import { z } from 'zod';
import { ServerConfig } from '../../config';
import { FeatureFlagDbController } from '../common/feature-flag-db-controller';
import { hasCompletedQuestionnaire } from '../common/questionnaire-completion';
import { OzgInfoDbController } from '../ozg-info/ozg-info-db-controller';
import { UserDocumentDbController } from '../user-documents/user-document-db-controller';
import {
  filterActiveHwkAttachments,
  mergePdfDocuments,
} from './hwk-application-pdf';
import { buildHwkFormData } from './hwk-form-builder';
import { HwkFormDbController } from './hwk-form-db-controller';
import { HwkFormPdfService } from './hwk-form-pdf-service';
import { HwkMailService } from './hwk-mail-service';

async function ensureHwkEnabled(trx: Knex.Transaction): Promise<void> {
  const featureFlagDbController = new FeatureFlagDbController(trx);
  const row = await featureFlagDbController.getByName('hwk');

  if (!row) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Resource could not be found.',
    });
  }

  if (!row.enabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Resource is deactivated.',
    });
  }
}

function filterAnswersByTracking(
  answers: Answers[],
  answeredKeys: string[] | null | undefined
): Answers[] {
  if (!answeredKeys || answeredKeys.length === 0) {
    return answers;
  }

  const answeredKeySet = new Set(answeredKeys);
  return answers.filter((answer) => answeredKeySet.has(answer.key));
}

export function buildHwkFormRouter(serverConfig: ServerConfig) {
  const pdfService = new HwkFormPdfService();

  const filledPdfSchema = z.object({
    data: z.instanceof(Uint8Array),
    filename: z.string(),
    mimeType: z.literal('application/pdf'),
  });

  return router({
    get: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.number())
      .output(HwkFormDataSchema)
      .query(async (req) => {
        await req.ctx.trxFactory(async (trx) => {
          await ensureHwkEnabled(trx);
        });

        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input, req.ctx.token?.sub);
        });

        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        return req.ctx.trxFactory(async (trx) => {
          const controller = new HwkFormDbController(trx);
          const project = await controller.getProjectById(req.input);
          if (!project) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Project not found',
            });
          }

          const userId = req.ctx.token?.sub;
          if (!userId) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User authentication required',
            });
          }

          const user = await controller.getUserById(userId);
          if (!user) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'User not found',
            });
          }

          const profileInfo = await controller.getProfileInfoByUserId(userId);
          const tracking = await controller.getQuestionTrackingByProjectId(
            req.input
          );
          const answers = await controller.getAnswersByProjectId(req.input);
          const filteredAnswers = filterAnswersByTracking(
            answers,
            tracking?.answeredQuestions
          );

          return buildHwkFormData({
            answers: filteredAnswers,
            project,
            user,
            profileInfo: profileInfo ?? null,
          });
        });
      }),

    getFilledPdf: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.number())
      .output(filledPdfSchema)
      .query(async (req) => {
        await req.ctx.trxFactory(async (trx) => {
          await ensureHwkEnabled(trx);
        });

        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input, req.ctx.token?.sub);
        });

        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        const { formData, project, filteredAnswers, hwkAttachments } =
          await req.ctx.trxFactory(async (trx) => {
            const controller = new HwkFormDbController(trx);
            const userDocumentDbController = new UserDocumentDbController(trx);
            const project = await controller.getProjectById(req.input);
            if (!project) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Project not found',
              });
            }

            const userId = req.ctx.token?.sub;
            if (!userId) {
              throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'User authentication required',
              });
            }

            const user = await controller.getUserById(userId);
            if (!user) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'User not found',
              });
            }

            const profileInfo = await controller.getProfileInfoByUserId(userId);
            const answers = await controller.getAnswersByProjectId(req.input);
            const tracking = await controller.getQuestionTrackingByProjectId(
              req.input
            );
            const isCompleted = hasCompletedQuestionnaire(
              answers,
              tracking?.answeredQuestions
            );

            if (project.progress !== 100 || !isCompleted) {
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'Project questionnaire is not finished yet',
              });
            }

            const filteredAnswers = filterAnswersByTracking(
              answers,
              tracking?.answeredQuestions
            );
            const hwkAttachments =
              await userDocumentDbController.listHwkMailAttachments(
                userId,
                project.id
              );

            const formData = buildHwkFormData({
              answers: filteredAnswers,
              project,
              user,
              profileInfo: profileInfo ?? null,
            });

            return { formData, project, filteredAnswers, hwkAttachments };
          });

        const pdfBytes = await pdfService.generateFilledPdf(formData);
        const activeHwkAttachments = filterActiveHwkAttachments(
          hwkAttachments,
          filteredAnswers,
          project
        );
        const combinedPdfBytes = await mergePdfDocuments([
          pdfBytes,
          ...activeHwkAttachments.map((attachment) => attachment.data),
        ]);

        return {
          data: combinedPdfBytes,
          filename: `HWK-Antrag-${project.id}.pdf`,
          mimeType: 'application/pdf',
        };
      }),

    sendHwkMail: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.number())
      .output(HwkMailStatusSchema)
      .mutation(async (req) => {
        await req.ctx.trxFactory(async (trx) => {
          await ensureHwkEnabled(trx);
        });

        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input, req.ctx.token?.sub);
        });

        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        const userId = req.ctx.token?.sub;
        if (!userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
          });
        }

        const ozgInfo = await req.ctx.trxFactory(async (trx) => {
          const ozgInfoController = new OzgInfoDbController(trx);
          return await ozgInfoController.getByProjectId(req.input);
        });

        if (ozgInfo.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No OEID found for the provided project',
          });
        }

        const mailService = new HwkMailService(
          serverConfig,
          req.ctx.trxFactory
        );
        return await mailService.queueAndSend(req.input, userId);
      }),

    getHwkMailStatus: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.number())
      .output(HwkMailStatusSchema)
      .query(async (req) => {
        await req.ctx.trxFactory(async (trx) => {
          await ensureHwkEnabled(trx);
        });

        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input, req.ctx.token?.sub);
        });

        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        const userId = req.ctx.token?.sub;
        if (!userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
          });
        }

        const mailService = new HwkMailService(
          serverConfig,
          req.ctx.trxFactory
        );
        return await mailService.getStatus(req.input, userId);
      }),
  });
}
