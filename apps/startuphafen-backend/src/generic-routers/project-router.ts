import {
  Answers,
  gewaDisabledAnswers,
  HwkDocumentCaseSchema,
  isAllowed,
  projectKeysSchema,
  projectSchema,
  QuestionTracking,
  ProjectWithDocs,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { Knex } from 'knex';
import { z } from 'zod';
import { hasCompletedQuestionnaire } from '../features/common/questionnaire-completion';
import { UserDocumentDbController } from '../features/user-documents/user-document-db-controller';

const projectConfig = STARTUPHAFEN_ENTITY_SCHEMA.Project;

async function canMarkProjectAsFinished(
  trx: Knex.Transaction,
  projectId: number,
  userId?: string | null
) {
  const project = await trx(projectConfig.table.name)
    .where({ id: projectId, userId })
    .first();

  if (!project) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User is not allowed to access this project',
    });
  }

  const answers = await trx<Answers>(
    STARTUPHAFEN_ENTITY_SCHEMA.Answers.table.name
  ).where({ projectId });
  const tracking = await trx<QuestionTracking>(
    STARTUPHAFEN_ENTITY_SCHEMA.QuestionTracking.table.name
  )
    .where({ projectId })
    .orderBy('id', 'desc')
    .first();

  return hasCompletedQuestionnaire(answers, tracking?.answeredQuestions);
}

export const projectRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(projectSchema.omit({ id: true, userId: true, createdAt: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const createEntity = {
          ...req.input,
          userId: req.ctx.token?.sub,
          progress: 0,
          stSent: false,
          gwSent: false,
        };

        const result = await trx(projectConfig.table.name)
          .insert(createEntity)
          .returning('id');
        return result[0].id;
      });
    }),

  read: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(z.number().optional())
    .output(z.array(projectSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(projectConfig.table.name);
        if (req.input != null) {
          query.where({ id: req.input, userId: req.ctx.token?.sub });
        } else {
          query.where({ userId: req.ctx.token?.sub });
        }

        return projectSchema.array().parse(await query);
      });
    }),

  getProjectCount: baseProcedure
    .meta({
      requiredRolesAny: ['startuphafen-admin'],
      feature: null,
    })
    .output(z.number())
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const rows = await trx(projectConfig.table.name).count<
          { count: string }[]
        >('* as count');

        return Number(rows[0].count ?? 0);
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(projectSchema.partial().omit({ userId: true }))
    .output(z.array(projectSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        return await trx(projectConfig.table.name).where({
          ...req.input,
          userId: req.ctx.token?.sub,
        });
      });
    }),

  updateName: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        await trx(projectConfig.table.name)
          .where({ id: req.input.id, userId: req.ctx.token?.sub })
          .update({ name: req.input.name });
      });
    }),

  pickFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(
      z.object({
        pick: z.array(projectKeysSchema),
        filters: projectSchema.partial().omit({ userId: true }),
      })
    )
    .output(z.array(projectSchema.partial()))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(projectConfig.table.name);
        query.select(...req.input.pick);
        query.where({ ...req.input.filters, userId: req.ctx.token?.sub });

        return projectSchema
          .partial()
          .array()
          .parse(await query);
      });
    }),

  update: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(
      z.object({
        id: z.number(),
        updates: projectSchema
          .partial()
          .omit({ id: true, userId: true, createdAt: true }),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const updates = { ...req.input.updates };
        if (updates.stSent !== undefined || updates.gwSent !== undefined) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Submission flags are managed by the server',
          });
        }

        if (updates.progress !== undefined) {
          if (updates.progress >= 100) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Projects can only be marked as finished through the questionnaire completion flow',
            });
          }

          updates.progress = Math.max(0, Math.min(99, updates.progress));
        }

        await trx(projectConfig.table.name)
          .where({ id: req.input.id, userId: req.ctx.token?.sub })
          .update(updates);
      });
    }),

  markQuestionnaireComplete: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(z.number())
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const canFinish = await canMarkProjectAsFinished(
          trx,
          req.input,
          req.ctx.token?.sub
        );

        if (!canFinish) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Project questionnaire cannot be marked as finished yet',
          });
        }

        await trx(projectConfig.table.name)
          .where({ id: req.input, userId: req.ctx.token?.sub })
          .update({ progress: 100 });
      });
    }),

  delete: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(z.number())
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        await trx(projectConfig.table.name)
          .where({ id: req.input, userId: req.ctx.token?.sub })
          .delete();
      });
    }),
  gewADisabled: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(z.number())
    .output(z.union([z.boolean(), z.null()]))
    .query(async (req) => {
      const allowed = await req.ctx.trxFactory(async (trx) => {
        return isAllowed(trx, req.input, req.ctx.token?.sub);
      });

      if (!allowed) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not allowed to access this project',
        });
      }

      return await req.ctx.trxFactory(async (trx) => {
        const result = await trx(
          STARTUPHAFEN_ENTITY_SCHEMA.Answers.table.name
        ).where({
          projectId: req.input,
          key: 'Us1',
        });

        for (const e of result) {
          if (gewaDisabledAnswers.includes(e.value)) {
            return true;
          }
        }
        return false;
      });
    }),

  readAndAppendDocs: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .output(z.array(ProjectWithDocs))
    .query(async (req) => {
      const userId = req.ctx.token?.sub;
      if (userId == null) throw new Error('No User!');
      const projects = await req.ctx.trxFactory(async (trx) => {
        const query = trx(projectConfig.table.name).where({ userId: userId });
        return projectSchema.array().parse(await query);
      });

      if (projects.length === 0) return [];

      const projectsWithDoc: ProjectWithDocs[] = await req.ctx.trxFactory(
        async (trx) => {
          const result: ProjectWithDocs[] = [];
          const docController = new UserDocumentDbController(trx);
          const docList = await docController.list(userId);
          const sortedDocList = [...docList].sort((a, b) => {
            const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
            if (createdAtDiff !== 0) return createdAtDiff;
            return b.id - a.id;
          });
          for (const p of projects) {
            const projectDocs = sortedDocList.filter(
              (e) => e.projectId === p.id
            );
            const docObject: {
              stEr: ProjectWithDocs['stEr'];
              gewA: ProjectWithDocs['gewA'];
              hwkDocuments: ProjectWithDocs['hwkDocuments'];
            } = { stEr: null, gewA: null, hwkDocuments: [] };
            const newestStErDoc = projectDocs.find((doc) =>
              doc.filename.includes('Steuerliche_Erfassung')
            );
            const newestGewADoc = projectDocs.find((doc) =>
              doc.filename.includes('Gewerbeanmeldung')
            );

            if (newestStErDoc != null) {
              docObject.stEr = newestStErDoc;
            }

            if (newestGewADoc != null) {
              docObject.gewA = newestGewADoc;
            }

            docObject.hwkDocuments = [...projectDocs]
              .reverse()
              .reduce<ProjectWithDocs['hwkDocuments']>((documents, document) => {
                const parsedDocumentCase = HwkDocumentCaseSchema.safeParse(
                  document.documentCase
                );

                if (!parsedDocumentCase.success) {
                  return documents;
                }

                documents.push({
                  id: document.id,
                  filename: document.filename,
                  mimeType: document.mimeType,
                  createdAt: document.createdAt,
                  documentCase: parsedDocumentCase.data,
                });

                return documents;
              }, []);
            result.push({ ...p, ...docObject });
          }
          return result;
        }
      );
      return projectsWithDoc;
    }),

  readDocumentData: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(
      z.object({
        projectId: z.number(),
        docId: z.number(),
      })
    )
    .output(
      z.object({
        data: z.instanceof(Uint8Array),
      })
    )
    .query(async (req) => {
      const userId = req.ctx.token?.sub;
      if (userId == null) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      return await req.ctx.trxFactory(async (trx) => {
        const allowed = await isAllowed(trx, req.input.projectId, userId);
        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        const docController = new UserDocumentDbController(trx);
        const document = await docController.getData(
          userId,
          req.input.docId,
          req.input.projectId
        );

        if (document == null) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document not found',
          });
        }

        return {
          data: Uint8Array.from(document.data),
        };
      });
    }),
});
