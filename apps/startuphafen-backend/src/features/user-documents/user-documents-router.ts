import {
  CHECKLIST_DOCUMENTS,
  HwkDocumentCase,
  HwkDocumentCaseSchema,
  isAllowed,
  MAX_HWK_DOCUMENT_SIZE_BYTES,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream } from 'pdf-lib';
import { z } from 'zod';
import { RateLimiter } from '../common/rate-limiter';
import { UserDocumentDbController } from './user-document-db-controller';

export const MAX_DOCUMENT_SIZE_BYTES = MAX_HWK_DOCUMENT_SIZE_BYTES;
export const MAX_HWK_DOCUMENTS_PER_CASE = 10;
export const MAX_HWK_TOTAL_SIZE_BYTES_PER_CASE = MAX_HWK_DOCUMENT_SIZE_BYTES;

const FORBIDDEN_PDF_NAMES = new Set([
  'JavaScript',
  'JS',
  'OpenAction',
  'AA',
  'Launch',
  'EmbeddedFile',
  'EmbeddedFiles',
  'RichMedia',
  'XFA',
]);

async function ensureSafePdf(file: Uint8Array) {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(file, {
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
  } catch {
    console.warn(
      `[pdf-upload] rejected: parse failed (bytes=${file.byteLength})`
    );
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Uploaded file is not a valid PDF',
    });
  }

  for (const [, object] of pdfDoc.context.enumerateIndirectObjects()) {
    if (objectTreeContainsForbiddenName(object)) {
      console.warn(
        `[pdf-upload] rejected: active content (bytes=${file.byteLength})`
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Uploaded PDF contains unsupported active content',
      });
    }
  }

  for (const value of Object.values(pdfDoc.context.trailerInfo)) {
    if (objectTreeContainsForbiddenName(value)) {
      console.warn(
        `[pdf-upload] rejected: active content in trailer (bytes=${file.byteLength})`
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Uploaded PDF contains unsupported active content',
      });
    }
  }
}

function objectTreeContainsForbiddenName(value: unknown): boolean {
  if (value instanceof PDFName) {
    return FORBIDDEN_PDF_NAMES.has(value.decodeText());
  }

  if (value instanceof PDFStream) {
    return objectTreeContainsForbiddenName(value.dict);
  }

  if (value instanceof PDFDict) {
    for (const [key, entryValue] of value.entries()) {
      if (FORBIDDEN_PDF_NAMES.has(key.decodeText())) {
        return true;
      }
      if (objectTreeContainsForbiddenName(entryValue)) {
        return true;
      }
    }
    return false;
  }

  if (value instanceof PDFArray) {
    for (let index = 0; index < value.size(); index++) {
      if (objectTreeContainsForbiddenName(value.get(index))) {
        return true;
      }
    }
  }

  return false;
}

async function documentCaseValidation(
  input: {
    file: Uint8Array;
    filename: string;
    mimeType: string;
    projectId: number;
    documentCase?: HwkDocumentCase;
  },
  controller: UserDocumentDbController,
  userId: string,
  skipDocumentId?: number
) {
  if (input.documentCase) {
    const stats = await controller.getCaseStats(
      userId,
      input.projectId,
      input.documentCase,
      skipDocumentId
    );

    if (stats.count >= MAX_HWK_DOCUMENTS_PER_CASE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Maximum number of documents for this case reached',
      });
    }

    if (
      stats.totalBytes + input.file.byteLength >
      MAX_HWK_TOTAL_SIZE_BYTES_PER_CASE
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Total document size for this case exceeds limit',
      });
    }
  }
}

const uploadInputSchema = z.object({
  file: z
    .instanceof(Uint8Array)
    .refine((file) => file.byteLength > 0, {
      message: 'File cannot be empty',
    })
    .refine((file) => file.byteLength <= MAX_DOCUMENT_SIZE_BYTES, {
      message: 'File exceeds maximum allowed size',
    }),
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => value.toLowerCase().endsWith('.pdf'), {
      message: 'Only PDF files are supported',
    }),
  mimeType: z.literal('application/pdf'),
  projectId: z.number(),
  documentCase: HwkDocumentCaseSchema.optional(),
});

const metadataDataSchema = z.object({
  id: z.number(),
  filename: z.string(),
  mimeType: z.string(),
  createdAt: z.date(),
  projectId: z.number().nullable(),
  documentCase: z.string().nullable(),
});

export function buildUserDocumentsRouter(uploadLimiter: RateLimiter) {
  return router({
    upload: baseProcedure
      .use(uploadLimiter)
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(uploadInputSchema)
      .output(metadataDataSchema)
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        await ensureSafePdf(req.input.file);

        return await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, req.input.projectId, userId);
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }

          const controller = new UserDocumentDbController(trx);

          await documentCaseValidation(req.input, controller, userId);

          return await controller.upload(userId, req.input);
        });
      }),

    uploadOverwriteFilename: baseProcedure
      .use(uploadLimiter)
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(uploadInputSchema)
      .output(z.void())
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);
        await ensureSafePdf(req.input.file);

        return await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, req.input.projectId, userId);
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }

          const controller = new UserDocumentDbController(trx);

          const existingDocuments = await controller.listByProject(
            userId,
            req.input.projectId
          );
          const documentToOverwrite = existingDocuments.find(
            (doc) =>
              doc.filename === req.input.filename &&
              (doc.documentCase ?? undefined) === req.input.documentCase
          );
          if (documentToOverwrite === undefined) {
            await documentCaseValidation(req.input, controller, userId);

            await controller.upload(userId, req.input);
          } else {
            if (
              ![
                CHECKLIST_DOCUMENTS.GS_CONTRACT,
                CHECKLIST_DOCUMENTS.SH_CONTRACT,
                CHECKLIST_DOCUMENTS.HR_EXTRACT,
              ].includes(documentToOverwrite.filename)
            ) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'This document cannot be updated',
              });
            }

            await documentCaseValidation(
              {
                file: req.input.file,
                filename: documentToOverwrite.filename,
                mimeType: documentToOverwrite.mimeType,
                projectId: req.input.projectId,
                documentCase:
                  (documentToOverwrite.documentCase as HwkDocumentCase) ??
                  undefined,
              },
              controller,
              userId,
              documentToOverwrite.id
            );

            await controller.updateContent(
              documentToOverwrite.id,
              req.input.file
            );
          }
        });
      }),

    listByProject: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(
        z.object({
          projectId: z.number(),
        })
      )
      .output(z.array(metadataDataSchema))
      .query(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);

        return await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, req.input.projectId, userId);
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }

          const controller = new UserDocumentDbController(trx);
          return await controller.listByProject(userId, req.input.projectId);
        });
      }),

    listByCase: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(
        z.object({
          projectId: z.number(),
          documentCase: HwkDocumentCaseSchema,
        })
      )
      .output(z.array(metadataDataSchema))
      .query(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);

        return await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, req.input.projectId, userId);
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }

          const controller = new UserDocumentDbController(trx);
          return await controller.listByProjectAndCase(
            userId,
            req.input.projectId,
            req.input.documentCase
          );
        });
      }),

    delete: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(z.object({ docId: z.number(), projectId: z.number() }))
      .output(z.number().nullable())
      .mutation(async (req) => {
        const userId = requireUserId(req.ctx.token?.sub);

        return await req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, req.input.projectId, userId);
          if (!allowed) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'User is not allowed to access this project',
            });
          }

          const controller = new UserDocumentDbController(trx);
          const result = await controller.delete(req.input.docId, userId);
          if (result == null) {
            console.log(
              '> UserDoc delete: Entry Not Found, No further operation'
            );
            return null;
          }
          return result;
        });
      }),
  });
}

function requireUserId(userId?: string | null) {
  if (!userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User authentication required',
    });
  }
  return userId;
}
