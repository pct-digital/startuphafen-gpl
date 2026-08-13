import { Answers, Project } from '@startuphafen/startuphafen-common';
import { PDFDocument } from 'pdf-lib';

// Note: hwk-mail-service.ts has a similar private helper pair with slightly
// different rules (the mail flow attaches the HR extract for every kapg
// project, the PDF download only for the St67 case). The divergence is
// intentional and covered by tests.
export function filterActiveHwkAttachments<
  T extends { documentCase: string | null },
>(attachments: T[], answers: Answers[], project: Project): T[] {
  return attachments.filter((attachment) =>
    isAttachmentCaseActive(attachment.documentCase, answers, project)
  );
}

export async function mergePdfDocuments(
  pdfDocuments: readonly Uint8Array[]
): Promise<Uint8Array> {
  if (pdfDocuments.length === 1) {
    return pdfDocuments[0];
  }

  const mergedPdf = await PDFDocument.create();

  for (const [index, pdfDocument] of pdfDocuments.entries()) {
    let sourcePdf: PDFDocument;
    try {
      sourcePdf = await PDFDocument.load(pdfDocument);
    } catch (error) {
      // The generated form is required. Uploaded attachments are best-effort so
      // one malformed or encrypted document does not block the whole download.
      if (index === 0) {
        throw error;
      }
      continue;
    }

    const copiedPages = await mergedPdf.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices()
    );

    for (const copiedPage of copiedPages) {
      mergedPdf.addPage(copiedPage);
    }
  }

  return await mergedPdf.save();
}

function isAttachmentCaseActive(
  documentCase: string | null,
  answers: Answers[],
  project: Project
): boolean {
  if (documentCase === 'hwk_qualification_proof') {
    return getAnswerValue(answers, 'HwkEntryType') === 'hwkEntryAns-1';
  }

  if (documentCase === 'hwk_hr_extract') {
    return (
      project.catalogueId === 'kapg' &&
      getAnswerValue(answers, 'St67') === 'st67Ans-1'
    );
  }

  return false;
}

function getAnswerValue(answers: Answers[], key: string): string | null {
  const answer = answers.find((item) => item.key === key);
  return answer?.value ?? null;
}
