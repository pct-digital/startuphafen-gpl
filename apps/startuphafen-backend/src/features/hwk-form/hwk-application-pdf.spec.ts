import { Answers, Project } from '@startuphafen/startuphafen-common';
import { PDFDocument } from 'pdf-lib';
import {
  filterActiveHwkAttachments,
  mergePdfDocuments,
} from './hwk-application-pdf';

describe('mergePdfDocuments', () => {
  it('keeps the input order when combining multiple pdfs', async () => {
    const formPdf = await createPdfDocument(100, 100);
    const qualificationPdf = await createPdfDocument(200, 200);
    const hrExtractPdf = await createPdfDocument(300, 300);

    const mergedBytes = await mergePdfDocuments([
      formPdf,
      qualificationPdf,
      hrExtractPdf,
    ]);

    const mergedPdf = await PDFDocument.load(mergedBytes);
    const mergedPages = mergedPdf.getPages();

    expect(mergedPages).toHaveLength(3);
    expect(mergedPages[0].getSize()).toEqual({ width: 100, height: 100 });
    expect(mergedPages[1].getSize()).toEqual({ width: 200, height: 200 });
    expect(mergedPages[2].getSize()).toEqual({ width: 300, height: 300 });
  });

  it('skips malformed attachment pdfs and keeps valid pages', async () => {
    const formPdf = await createPdfDocument(100, 100);
    const malformedAttachment = new Uint8Array([1, 2, 3, 4]);
    const hrExtractPdf = await createPdfDocument(300, 300);

    const mergedBytes = await mergePdfDocuments([
      formPdf,
      malformedAttachment,
      hrExtractPdf,
    ]);

    const mergedPdf = await PDFDocument.load(mergedBytes);
    const mergedPages = mergedPdf.getPages();

    expect(mergedPages).toHaveLength(2);
    expect(mergedPages[0].getSize()).toEqual({ width: 100, height: 100 });
    expect(mergedPages[1].getSize()).toEqual({ width: 300, height: 300 });
  });
});

describe('filterActiveHwkAttachments', () => {
  it('keeps only the qualification proof for Handwerksrolle projects', () => {
    const attachments: Array<{
      id: number;
      documentCase: 'hwk_qualification_proof' | 'hwk_hr_extract' | null;
    }> = [
      { id: 1, documentCase: 'hwk_qualification_proof' },
      { id: 2, documentCase: 'hwk_hr_extract' },
      { id: 3, documentCase: null },
    ];

    const filteredAttachments = filterActiveHwkAttachments(
      attachments,
      [buildAnswer('HwkEntryType', 'hwkEntryAns-1')],
      buildProject('eun')
    );

    expect(filteredAttachments.map((attachment) => attachment.id)).toEqual([1]);
  });

  it('keeps both hwk attachment types for kapg projects with active hr extract', () => {
    const attachments: Array<{
      id: number;
      documentCase: 'hwk_qualification_proof' | 'hwk_hr_extract';
    }> = [
      { id: 1, documentCase: 'hwk_qualification_proof' },
      { id: 2, documentCase: 'hwk_hr_extract' },
    ];

    const filteredAttachments = filterActiveHwkAttachments(
      attachments,
      [
        buildAnswer('HwkEntryType', 'hwkEntryAns-1'),
        buildAnswer('St67', 'st67Ans-1'),
      ],
      buildProject('kapg')
    );

    expect(filteredAttachments.map((attachment) => attachment.id)).toEqual([
      1, 2,
    ]);
  });
});

async function createPdfDocument(
  width: number,
  height: number
): Promise<Uint8Array> {
  const pdfDocument = await PDFDocument.create();
  pdfDocument.addPage([width, height]);
  return await pdfDocument.save();
}

function buildAnswer(key: string, value: string): Answers {
  return {
    answerText: value,
    componentId: key,
    headerText: null,
    id: 1,
    key,
    projectId: 1,
    questionText: key,
    stringValue: value,
    type: 'singleSelect',
    value,
    xmlKey: '/',
  };
}

function buildProject(catalogueId: Project['catalogueId']): Project {
  return {
    catalogueId,
    gwSent: false,
    id: 1,
    lastPosition: 0,
    name: 'Test Project',
    progress: 100,
    stSent: false,
    userId: 'test-user',
    createdAt: new Date(),
  };
}
