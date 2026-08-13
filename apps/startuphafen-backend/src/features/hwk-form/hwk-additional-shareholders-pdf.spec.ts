import { HwkFormData, HwkFormShareholder } from '@startuphafen/startuphafen-common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { buildAdditionalShareholdersPdf } from './hwk-additional-shareholders-pdf';

const FONT_PATH = join(
  __dirname,
  '..',
  '..',
  'assets',
  'forms',
  'fonts',
  'Montserrat-Regular.ttf'
);

const person = (
  over: Partial<HwkFormShareholder> = {}
): HwkFormShareholder => ({
  isCompany: false,
  companyName: null,
  firstName: 'Test',
  lastName: 'Person',
  birthDate: '1980-04-15',
  birthPlace: 'Lübeck',
  nationality: 'DE',
  gender: 'weiblich',
  address: {
    street: 'Anteilsweg',
    houseNumber: '7b',
    postalCode: '23552',
    city: 'Lübeck',
    addressExtra: null,
  },
  ...over,
});

const emptyPerson = {
  firstName: null,
  lastName: null,
  birthDate: null,
  birthPlace: null,
  nationality: null,
  gender: null,
  address: {
    street: null,
    houseNumber: null,
    postalCode: null,
    city: null,
    addressExtra: null,
  },
  phone: null,
  mobile: null,
  email: null,
  internet: null,
};

const buildData = (shareholders: HwkFormShareholder[]): HwkFormData => ({
  entryType: null,
  tradeDescription: null,
  qualification: {
    examDate: null,
    examPlace: null,
    trade: null,
    trainingPermit: null,
  },
  priorBusiness: { hasPrior: null, details: null },
  owner: emptyPerson,
  legalForm: 'GmbH',
  handelsregister: { registered: false, companyName: null },
  business: {
    name: 'Test GmbH',
    startDate: null,
    establishmentType: null,
    relocationFrom: null,
    takeoverFrom: null,
  },
  businessLocation: {
    street: null,
    houseNumber: null,
    addressExtra: null,
    postalCode: null,
    city: null,
    phone: null,
    mobile: null,
    fax: null,
    email: null,
    internet: null,
    deliveryAddress: null,
    locationType: null,
    mainOfficeAddress: null,
  },
  technicalManager: emptyPerson,
  additionalShareholders: shareholders,
});

describe('buildAdditionalShareholdersPdf', () => {
  let font: Uint8Array;

  beforeAll(async () => {
    font = new Uint8Array(await readFile(FONT_PATH));
  });

  it('returns null when there are no shareholders beyond person b)', async () => {
    expect(await buildAdditionalShareholdersPdf(buildData([]), font)).toBeNull();
    expect(
      await buildAdditionalShareholdersPdf(buildData([person()]), font)
    ).toBeNull();
  });

  it('renders a valid PDF starting at the third shareholder', async () => {
    const shareholders = [
      person({ lastName: 'Zwei' }),
      person({ lastName: 'Drei' }),
      person({
        isCompany: true,
        companyName: 'Firma X GmbH',
        firstName: null,
        lastName: null,
        gender: null,
      }),
    ];

    const bytes = await buildAdditionalShareholdersPdf(
      buildData(shareholders),
      font
    );
    expect(bytes).not.toBeNull();

    const doc = await PDFDocument.load(bytes!);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('paginates when many shareholders are present', async () => {
    const shareholders = Array.from({ length: 20 }, (_, i) =>
      person({ lastName: `Person${i}` })
    );

    const bytes = await buildAdditionalShareholdersPdf(
      buildData(shareholders),
      font
    );
    const doc = await PDFDocument.load(bytes!);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
