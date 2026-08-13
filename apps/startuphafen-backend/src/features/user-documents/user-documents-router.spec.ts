import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Project,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { TRPCError } from '@trpc/server';
import { migrateDatabase } from '../../assets-loader';
import { createRateLimiter } from '../common/rate-limiter';
import { UserDocumentDbController } from './user-document-db-controller';
import {
  buildUserDocumentsRouter,
  MAX_HWK_DOCUMENTS_PER_CASE,
  MAX_HWK_TOTAL_SIZE_BYTES_PER_CASE,
} from './user-documents-router';

const disabledRateLimiter = createRateLimiter({
  enabled: false,
  max: 1,
  windowMs: 1,
});

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

const baseUser: ShUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  cellPhoneNumber: '0000000000',
  phoneNumber: '0000000001',
  street: 'Some Street',
  postalCode: '12345',
  city: 'Berlin',
  inboxReference: '',
  country: 'Germany',
  dateOfBirth: '1990-01-01',
  academicTitle: null,
  title: null,
  name: null,
  roles: ['bundID-high'],
  createdAt: new Date(),
};

const baseProject: Project = {
  createdAt: new Date(),
  id: 100,
  name: 'Test Project',
  catalogueId: 'cat-1',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: baseUser.id,
};

const createToken = (roles: string[]) => ({
  sub: baseUser.id,
  realm_access: {
    roles,
  },
});

const fakePdfBytes = new Uint8Array(
  Buffer.from('this is not actually a pdf file', 'utf8')
);

const validPdfBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    'utf8'
  )
);

const pdfWithJavascriptBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /OpenAction 2 0 R >>
endobj
2 0 obj
<< /Type /Action /S /JavaScript /JS (app.alert('owned')) >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    'utf8'
  )
);

// Valid PDF header but a malformed object body. With strict parsing
// (`throwOnInvalidObject: true`) pdf-lib must throw on this, which proves
// we don't fall back to a lenient PDFInvalidObject wrapper that would let
// our walk silently skip the object.
const pdfWithMalformedBodyBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages NOT_A_VALID_REFERENCE >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    'utf8'
  )
);

// Forbidden token /Launch buried several levels deep through an array nested
// inside a dict nested inside another dict. Exercises that the walk descends
// through both PDFDict and PDFArray, not only top-level dict keys.
const pdfWithDeeplyNestedLaunchBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Custom [ << /Wrapped << /Hidden << /S /Launch >> >> >> ] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    'utf8'
  )
);

// Forbidden token /OpenAction placed in the trailer's /Info dict directly.
// The trailer is not part of enumerateIndirectObjects, so this only gets
// caught by the dedicated trailerInfo walk.
const pdfWithForbiddenTrailerBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
trailer
<< /Root 1 0 R /Info << /Title (Foo) /OpenAction (anything) >> >>
%%EOF`,
    'utf8'
  )
);

// File-attachment annotation: the dangerous token /EmbeddedFile appears as the
// VALUE of /Type on the stream dict, not as a dict key. /FileAttachment is the
// annotation subtype that carries it. A check that only inspects dict keys
// would miss this construction.
const pdfWithEmbeddedFileAttachmentBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Annots [4 0 R] >>
endobj
4 0 obj
<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 10 10] /FS 5 0 R >>
endobj
5 0 obj
<< /Type /Filespec /F (payload.bin) /EF << /F 6 0 R >> >>
endobj
6 0 obj
<< /Type /EmbeddedFile /Length 4 >>
stream
test
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    'utf8'
  )
);

// Aggressive variant of the hex-encoding bypass: every single character of
// the dangerous tokens (/OpenAction, /JavaScript, /JS) is rewritten with #xx
// escapes, including a proper xref table and startxref offset so pdf-lib can
// validate the document under strict parsing. A reader normalises the names
// to their decoded form, so the action still fires; our walk must match the
// decoded name, not the raw bytes.
const pdfWithFullyHexEncodedTokensBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /#4F#70#65#6E#41#63#74#69#6F#6E 4 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>
endobj
4 0 obj
<< /Type /Action /S /#4A#61#76#61#53#63#72#69#70#74 /#4A#53 (app.alert("XSS
Bypass");) >>
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000097 00000 n
0000000155 00000 n
0000000228 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
350
%%EOF`,
    'utf8'
  )
);

// Same payload as pdfWithJavascriptBytes, but the dangerous PDF name tokens
// /OpenAction, /JavaScript and /JS are written using the PDF spec's #xx hex
// escapes. A naive lowercase string match on the raw bytes will not find
// `/openaction` or `/javascript` in here — pdf-lib's parser decodes them.
const pdfWithHexEncodedJavascriptBytes = new Uint8Array(
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /#4FpenAction 2 0 R >>
endobj
2 0 obj
<< /Type /Action /S /#4Aava#53cript /#4AS (app.alert('owned')) >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    'utf8'
  )
);

describe('UserDocumentsRouter', () => {
  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(async (trx) => await work(trx), {
        isolationLevel: 'serializable',
        readOnly,
      });
    };
  };

  const createCaller = (roles: string[] = ['bundID-high']) => {
    const router = buildUserDocumentsRouter(disabledRateLimiter);
    return router.createCaller({
      trxFactory: createTrxFactory(),
      token: createToken(roles),
    });
  };

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert(baseUser);

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert(baseProject);

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('listByCase returns only documents of the selected case', async () => {
    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert([
        {
          userId: baseUser.id,
          filename: 'qualification-1.pdf',
          mimeType: 'application/pdf',
          documentCase: 'hwk_qualification_proof',
          data: new Uint8Array([1]),
          projectId: baseProject.id,
        },
        {
          userId: baseUser.id,
          filename: 'hr-extract.pdf',
          mimeType: 'application/pdf',
          documentCase: 'hwk_hr_extract',
          data: new Uint8Array([2]),
          projectId: baseProject.id,
        },
      ]);

    const caller = createCaller();
    const result = await caller.listByCase({
      projectId: baseProject.id,
      documentCase: 'hwk_qualification_proof',
    });

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('qualification-1.pdf');
    expect(result[0].documentCase).toBe('hwk_qualification_proof');
  });

  it('listByCase allows users with bundID-low', async () => {
    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert({
        userId: baseUser.id,
        filename: 'hr-extract.pdf',
        mimeType: 'application/pdf',
        documentCase: 'hwk_hr_extract',
        data: new Uint8Array([1]),
        projectId: baseProject.id,
      });

    const caller = createCaller(['bundID-low']);
    const result = await caller.listByCase({
      projectId: baseProject.id,
      documentCase: 'hwk_hr_extract',
    });

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('hr-extract.pdf');
  });

  it('listByCase rejects users without bundID-low or bundID-high role', async () => {
    const caller = createCaller(['login']);

    await expect(
      caller.listByCase({
        projectId: baseProject.id,
        documentCase: 'hwk_hr_extract',
      })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    } satisfies Partial<TRPCError>);
  });

  it('upload rejects when max file count for a case is reached', async () => {
    const documents = [];
    for (let index = 0; index < MAX_HWK_DOCUMENTS_PER_CASE; index++) {
      documents.push({
        userId: baseUser.id,
        filename: `doc-${index}.pdf`,
        mimeType: 'application/pdf',
        documentCase: 'hwk_hr_extract',
        data: new Uint8Array([index + 1]),
        projectId: baseProject.id,
      });
    }

    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert(documents);

    const caller = createCaller();

    await expect(
      caller.upload({
        file: validPdfBytes,
        filename: 'too-many.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_hr_extract',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Maximum number of documents for this case reached',
    } satisfies Partial<TRPCError>);
  });

  it('upload rejects when max total size for a case is exceeded', async () => {
    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert({
        userId: baseUser.id,
        filename: 'big.pdf',
        mimeType: 'application/pdf',
        documentCase: 'hwk_qualification_proof',
        data: new Uint8Array(MAX_HWK_TOTAL_SIZE_BYTES_PER_CASE),
        projectId: baseProject.id,
      });

    const caller = createCaller();

    await expect(
      caller.upload({
        file: validPdfBytes,
        filename: 'overflow.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Total document size for this case exceeds limit',
    } satisfies Partial<TRPCError>);
  });

  it('rejects a .pdf upload when the bytes are not a PDF at all', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: fakePdfBytes,
        filename: 'fake.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_hr_extract',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('rejects PDFs that contain active JavaScript content', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: pdfWithJavascriptBytes,
        filename: 'malicious.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('rejects PDFs whose body is malformed despite a valid header', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: pdfWithMalformedBodyBytes,
        filename: 'malformed.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('rejects PDFs with forbidden tokens buried in nested arrays and dicts', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: pdfWithDeeplyNestedLaunchBytes,
        filename: 'nested-launch.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('rejects PDFs that smuggle forbidden tokens into the trailer dictionary', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: pdfWithForbiddenTrailerBytes,
        filename: 'trailer-smuggle.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('rejects PDFs that carry an embedded file via a file-attachment annotation', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: pdfWithEmbeddedFileAttachmentBytes,
        filename: 'malicious-attachment.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('rejects PDFs where every character of the dangerous tokens is hex-encoded', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: pdfWithFullyHexEncodedTokensBytes,
        filename: 'malicious-full-hex.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('rejects PDFs that hide active content behind hex-encoded name tokens', async () => {
    const caller = createCaller();

    await expect(
      caller.upload({
        file: pdfWithHexEncodedJavascriptBytes,
        filename: 'malicious-hex.pdf',
        mimeType: 'application/pdf',
        projectId: baseProject.id,
        documentCase: 'hwk_qualification_proof',
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('does not exceed the document-count limit under synchronized concurrent uploads', async () => {
    const existingDocuments = [];
    for (let index = 0; index < MAX_HWK_DOCUMENTS_PER_CASE - 1; index++) {
      existingDocuments.push({
        userId: baseUser.id,
        filename: `existing-${index}.pdf`,
        mimeType: 'application/pdf',
        documentCase: 'hwk_hr_extract',
        data: new Uint8Array([index + 1]),
        projectId: baseProject.id,
      });
    }

    await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .insert(existingDocuments);

    const caller = createCaller();
    const originalGetCaseStats =
      UserDocumentDbController.prototype.getCaseStats;
    let waitingCalls = 0;
    let releaseBarrier: (() => void) | null = null;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    jest
      .spyOn(UserDocumentDbController.prototype, 'getCaseStats')
      .mockImplementation(async function (
        this: UserDocumentDbController,
        ...args
      ) {
        const result = await originalGetCaseStats.apply(this, args);
        waitingCalls += 1;
        if (waitingCalls === 3) {
          releaseBarrier?.();
        }
        await barrier;
        return result;
      });

    const results = await Promise.allSettled(
      Array.from({ length: 3 }, (_, index) =>
        caller.upload({
          file: validPdfBytes,
          filename: `race-${index}.pdf`,
          mimeType: 'application/pdf',
          projectId: baseProject.id,
          documentCase: 'hwk_hr_extract',
        })
      )
    );

    const finalCount = await postgres
      .knex<UserDocument>(STARTUPHAFENBACKEND_TABLES.USERDOCUMENT)
      .where({
        userId: baseUser.id,
        projectId: baseProject.id,
        documentCase: 'hwk_hr_extract',
      })
      .count<{ count: string }[]>('* as count');

    expect(Number(finalCount[0].count)).toBeLessThanOrEqual(
      MAX_HWK_DOCUMENTS_PER_CASE
    );
    expect(
      results.filter((result) => result.status === 'fulfilled').length
    ).toBeLessThanOrEqual(1);
  });

  test('uploadOverwriteFilename overwrites document in project with same filename and case', async () => {
    jest
      .spyOn(UserDocumentDbController.prototype, 'listByProject')
      .mockImplementation(async () => {
        return [
          {
            filename: 'Gesellschaftsvertrag.pdf',
            mimeType: 'application/pdf',
            projectId: baseProject.id,
            documentCase: null,
            id: 1,
            createdAt: new Date(),
          },
        ];
      });

    const updateContentSpy = jest
      .spyOn(UserDocumentDbController.prototype, 'updateContent')
      .mockImplementation(async () => {});

    const caller = createCaller();

    await caller.uploadOverwriteFilename({
      file: validPdfBytes,
      filename: 'Gesellschaftsvertrag.pdf',
      mimeType: 'application/pdf',
      projectId: baseProject.id,
    });

    expect(updateContentSpy).toHaveBeenCalledWith(1, validPdfBytes);
  });

  test('uploadOverwriteFilename creates a new document if none matches', async () => {
    jest
      .spyOn(UserDocumentDbController.prototype, 'listByProject')
      .mockImplementation(async () => {
        return [
          {
            filename: 'Handelsregisterauszug.pdf',
            mimeType: 'application/pdf',
            projectId: baseProject.id,
            documentCase: null,
            id: 1,
            createdAt: new Date(),
          },
        ];
      });

    const uploadSpy = jest
      .spyOn(UserDocumentDbController.prototype, 'upload')
      .mockImplementation(async () => ({} as any));

    const caller = createCaller();

    await caller.uploadOverwriteFilename({
      file: validPdfBytes,
      filename: 'Gesellschaftsvertrag.pdf',
      mimeType: 'application/pdf',
      projectId: baseProject.id,
    });

    expect(uploadSpy).toHaveBeenCalledWith(baseUser.id, {
      file: validPdfBytes,
      filename: 'Gesellschaftsvertrag.pdf',
      mimeType: 'application/pdf',
      projectId: baseProject.id,
      documentCase: undefined,
    });
  });
});
