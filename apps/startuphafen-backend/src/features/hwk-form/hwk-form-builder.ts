import {
  Answers,
  HwkFormData,
  HwkFormShareholder,
  ProfileInfo,
  Project,
  ShUser,
  stringToBoolean,
} from '@startuphafen/startuphafen-common';

export type HwkFormBuildInput = {
  answers: Answers[];
  project: Project;
  user: ShUser;
  profileInfo: ProfileInfo | null;
};

const getAnswerByKey = (answers: Answers[], key: string) =>
  answers.find((answer) => answer.key === key) ?? null;

const getStringValue = (answers: Answers[], key: string): string | null => {
  const answer = getAnswerByKey(answers, key);
  if (!answer) return null;
  if (answer.stringValue != null) {
    return String(answer.stringValue);
  }
  return answer.value ?? null;
};

const getRawValue = (answers: Answers[], key: string): string | null => {
  const answer = getAnswerByKey(answers, key);
  return answer?.value ?? null;
};

const getBooleanValue = (
  answers: Answers[],
  key: string,
  optionMap?: Record<string, boolean>
): boolean | null => {
  const answer = getAnswerByKey(answers, key);
  if (!answer) return null;
  const raw = answer.stringValue ?? answer.value;
  if (raw == null || raw === '') return null;
  const normalized = String(raw).trim();
  if (optionMap && normalized in optionMap) {
    return optionMap[normalized] ?? null;
  }
  return stringToBoolean(normalized);
};

const parseStreetAddress = (
  street?: string | null
): { streetName: string | null; houseNumber: string | null } => {
  if (!street) {
    return { streetName: null, houseNumber: null };
  }
  const match = street.match(/\s+(\d+\w*(?:-\d+\w*)?)\s*$/);
  if (match) {
    const houseNumber = match[1];
    const streetName = street.substring(0, street.lastIndexOf(match[0])).trim();
    return { streetName, houseNumber };
  }
  return { streetName: street, houseNumber: null };
};

const mergeHouseNumberSuffix = (
  houseNumber: string | null,
  suffix: string | null
): string | null => {
  const base = houseNumber?.trim() ?? '';
  const extra = suffix?.trim() ?? '';
  if (!base && !extra) return null;
  if (!base) return extra || null;
  if (!extra) return base;
  return `${base}${extra}`;
};

const buildPhone = (
  prefix: string | null,
  number: string | null
): string | null => {
  if (!prefix && !number) return null;
  return [prefix, number].filter(Boolean).join(' ').trim();
};

const mapLegalForm = (
  answers: Answers[],
  catalogueId: string
): string | null => {
  if (catalogueId === 'eun') return 'Einzelunternehmen';
  const value = getRawValue(answers, 'St74');
  if (value === 'st74Ans-1') return 'GmbH';
  if (value === 'st74Ans-2') return 'UG (haftungsbeschränkt)';
  return null;
};

const mapGender = (title?: string | null): 'männlich' | 'weiblich' | null => {
  if (title === 'Herr') return 'männlich';
  if (title === 'Frau') return 'weiblich';
  return null;
};

const mapShareholderGender = (
  value: string | null
): 'männlich' | 'weiblich' | null => {
  if (value === 'männlich') return 'männlich';
  if (value === 'weiblich') return 'weiblich';
  // 'divers' (and anything else) has no representation on the paper form.
  return null;
};

// The shareholder steps (KAPG St81) persist each co-owner under keys
// suffixed with a 0-based index (e.g. St83b_0, St83b_1). We discover how many
// exist via a marker key that is always present per shareholder.
const collectShareholderIndices = (
  answers: Answers[],
  markerPrefix: string
): number[] => {
  const indices = new Set<number>();
  const pattern = new RegExp(`^${markerPrefix}_(\\d+)$`);
  for (const answer of answers) {
    const match = answer.key.match(pattern);
    if (match) {
      indices.add(Number(match[1]));
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
};

const buildShareholderAddress = (
  answers: Answers[],
  index: number,
  keys: {
    street: string;
    houseNumber: string;
    houseNumberSuffix: string;
    addressExtra: string;
    postalCode: string;
    city: string;
  }
) => ({
  street: getStringValue(answers, `${keys.street}_${index}`),
  houseNumber: mergeHouseNumberSuffix(
    getStringValue(answers, `${keys.houseNumber}_${index}`),
    getStringValue(answers, `${keys.houseNumberSuffix}_${index}`)
  ),
  postalCode: getStringValue(answers, `${keys.postalCode}_${index}`),
  city: getStringValue(answers, `${keys.city}_${index}`),
  addressExtra: getStringValue(answers, `${keys.addressExtra}_${index}`),
});

// Natural persons store their details under the St83* / Gw* keys regardless of
// whether they are a KAPG shareholder.
const NATURAL_PERSON_ADDRESS_KEYS = {
  street: 'St83h',
  houseNumber: 'St83i',
  houseNumberSuffix: 'St83j',
  addressExtra: 'St83k',
  postalCode: 'St83l',
  city: 'St83m',
} as const;

const buildNaturalPersonShareholder = (
  answers: Answers[],
  index: number
): HwkFormShareholder => ({
  isCompany: false,
  companyName: null,
  firstName: getStringValue(answers, `St83d_${index}`),
  lastName: getStringValue(answers, `St83b_${index}`),
  birthDate: getStringValue(answers, `St83f_${index}`),
  birthPlace: getStringValue(answers, `GwGeburtsort_${index}`),
  nationality: getStringValue(answers, `GwStaat_${index}`),
  gender: mapShareholderGender(
    getStringValue(answers, `GwGeschlecht_${index}`)
  ),
  address: buildShareholderAddress(answers, index, NATURAL_PERSON_ADDRESS_KEYS),
});

// A KAPG shareholder that is a company (Firma) carries only a name and address,
// stored under the St82* keys; it has no personal attributes.
const buildCompanyShareholder = (
  answers: Answers[],
  index: number
): HwkFormShareholder => ({
  isCompany: true,
  companyName: getStringValue(answers, `St82a_${index}`),
  firstName: null,
  lastName: null,
  birthDate: null,
  birthPlace: null,
  nationality: null,
  gender: null,
  address: buildShareholderAddress(answers, index, {
    street: 'St82c',
    houseNumber: 'St82d',
    houseNumberSuffix: 'St82e',
    addressExtra: 'St82f',
    postalCode: 'St82g',
    city: 'St82h',
  }),
});

// KAPG Anteilseigner (St81 step). Each entry is either a company (Firma) or a
// natural person, selected via Us4_<index>. Index 0 is the applicant and fills
// person a) (the owner), so it is excluded here; the remaining shareholders
// (index 1+) fill person b) and the generated extra page.
const buildKapgShareholders = (answers: Answers[]): HwkFormShareholder[] => {
  return collectShareholderIndices(answers, 'St81')
    .filter((index) => index !== 0)
    .map((index) => {
      const isCompany =
        getRawValue(answers, `Us4_${index}`) === `us4_${index}Ans-1`;

      return isCompany
        ? buildCompanyShareholder(answers, index)
        : buildNaturalPersonShareholder(answers, index);
    });
};

const mapHwkEntryType = (answers: Answers[]): string | null => {
  const stringValue = getStringValue(answers, 'HwkEntryType');
  if (stringValue && !stringValue.startsWith('hwkEntryAns-')) {
    return stringValue;
  }

  const rawValue = getRawValue(answers, 'HwkEntryType');
  if (rawValue === 'hwkEntryAns-1') return 'Handwerksrolle';
  if (rawValue === 'hwkEntryAns-2')
    return 'Verzeichnis der zulassungsfreien Handwerksbetriebe';
  if (rawValue === 'hwkEntryAns-3')
    return 'Verzeichnis der handwerksähnlichen Gewerbebetriebe';
  return stringValue;
};

export function buildHwkFormData({
  answers,
  project,
  user,
  profileInfo,
}: HwkFormBuildInput): HwkFormData {
  const catalogueId = project.catalogueId;
  const isKapg = catalogueId === 'kapg';

  // The BundID-authenticated applicant. For EUN they are the sole owner /
  // first founder. For KAPG they are the gesetzlicher Vertreter (technical
  // manager) and, unless the first Anteilseigner is a company, also the first
  // shareholder (person a). Their personal data always comes from BundID.
  const parsedUserStreet = parseStreetAddress(user.street);
  const bundIdPerson = {
    isCompany: false,
    companyName: null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    birthDate: user.dateOfBirth ?? null,
    birthPlace: profileInfo?.birthPlace ?? null,
    nationality: user.country ?? null,
    gender: mapGender(user.title),
    address: {
      street: parsedUserStreet.streetName,
      houseNumber: parsedUserStreet.houseNumber,
      postalCode: user.postalCode ?? null,
      city: user.city ?? null,
      addressExtra: null,
    },
    phone: profileInfo?.phoneNumber ?? user.phoneNumber ?? null,
    mobile:
      user.cellPhoneNumber && user.cellPhoneNumber !== ''
        ? user.cellPhoneNumber
        : null,
    email: user.email ?? null,
    internet: profileInfo?.website ?? null,
  };

  // KAPG: the first Anteilseigner (St81 index 0) is the "Antragssteller" and
  // fills person a). When it is a natural person, its personal fields are not
  // collected in the form (they come from BundID, see KapgSt81Component); when
  // it is a Firma, only the St82* company fields are collected. Either way the
  // remaining Anteilseigner (index 1+) fill person b) and the extra page.
  const firstShareholderIsCompany =
    isKapg && getRawValue(answers, 'Us4_0') === 'us4_0Ans-1';
  const kapgOwner = firstShareholderIsCompany
    ? {
        isCompany: true,
        companyName: getStringValue(answers, 'St82a_0'),
        firstName: null,
        lastName: null,
        birthDate: null,
        birthPlace: null,
        nationality: null,
        gender: null,
        address: buildShareholderAddress(answers, 0, {
          street: 'St82c',
          houseNumber: 'St82d',
          houseNumberSuffix: 'St82e',
          addressExtra: 'St82f',
          postalCode: 'St82g',
          city: 'St82h',
        }),
        phone: null,
        mobile: null,
        email: user.email ?? null,
        internet: null,
      }
    : bundIdPerson;

  const owner = isKapg ? kapgOwner : bundIdPerson;

  const businessAddressEunSame =
    getStringValue(answers, 'St68') !== 'st68Ans-2';
  const businessAddressEun = businessAddressEunSame
    ? {
        street: parsedUserStreet.streetName,
        houseNumber: parsedUserStreet.houseNumber,
        postalCode: user.postalCode ?? null,
        city: user.city ?? null,
        addressExtra: null,
      }
    : {
        street: getStringValue(answers, 'St69'),
        houseNumber: mergeHouseNumberSuffix(
          getStringValue(answers, 'St70a'),
          getStringValue(answers, 'St70b')
        ),
        postalCode: getStringValue(answers, 'St71a'),
        city: getStringValue(answers, 'St71b'),
        addressExtra: getStringValue(answers, 'St70c'),
      };

  const businessAddressKapg = {
    street: getStringValue(answers, 'St4'),
    houseNumber: mergeHouseNumberSuffix(
      getStringValue(answers, 'St5a'),
      getStringValue(answers, 'St5b')
    ),
    postalCode: getStringValue(answers, 'St6a'),
    city: getStringValue(answers, 'St6b'),
    addressExtra: getStringValue(answers, 'St5c'),
  };

  const businessAddress = isKapg ? businessAddressKapg : businessAddressEun;

  const companyPhone = isKapg
    ? buildPhone(
        getStringValue(answers, 'St12b'),
        getStringValue(answers, 'St12c')
      )
    : profileInfo?.phoneNumber ?? user.phoneNumber ?? null;
  const companyInternet = isKapg
    ? getStringValue(answers, 'St14')
    : profileInfo?.website ?? null;
  const companyEmail = user.email ?? null;

  const hasPriorBusiness = getBooleanValue(answers, 'HwkPriorBusiness', {
    'hwkPrior-1': true,
    'hwkPrior-2': false,
  });

  const additionalShareholders = isKapg ? buildKapgShareholders(answers) : [];

  return {
    entryType: mapHwkEntryType(answers),
    tradeDescription: getStringValue(answers, 'HwkTrade'),
    qualification: {
      examDate: getStringValue(answers, 'HwkQualificationDate'),
      examPlace: getStringValue(answers, 'HwkQualificationPlace'),
      trade: getStringValue(answers, 'HwkQualificationTrade'),
      trainingPermit: getBooleanValue(
        answers,
        'HwkQualificationTrainingPermit',
        {
          'hwkQualTrain-1': true,
          'hwkQualTrain-2': false,
        }
      ),
    },
    priorBusiness: {
      hasPrior: hasPriorBusiness,
      details:
        hasPriorBusiness === true
          ? getStringValue(answers, 'HwkPriorBusinessDetails')
          : null,
    },
    owner: owner,
    legalForm: mapLegalForm(answers, catalogueId),
    handelsregister: {
      registered: isKapg ? getBooleanValue(answers, 'St67') : false,
      companyName: isKapg ? getStringValue(answers, 'St3') : null,
    },
    business: {
      name: isKapg
        ? getStringValue(answers, 'St3')
        : project.name ?? null,
      startDate: isKapg
        ? getStringValue(answers, 'St77')
        : getStringValue(answers, 'St96'),
      establishmentType: null,
      relocationFrom: null,
      takeoverFrom: null,
    },
    businessLocation: {
      street: businessAddress.street,
      houseNumber: businessAddress.houseNumber,
      addressExtra: businessAddress.addressExtra ?? null,
      postalCode: businessAddress.postalCode,
      city: businessAddress.city,
      phone: companyPhone,
      mobile:
        !isKapg && user.cellPhoneNumber && user.cellPhoneNumber !== ''
          ? user.cellPhoneNumber
          : null,
      fax: null,
      email: companyEmail,
      internet: companyInternet,
      deliveryAddress: null,
      locationType: null,
      mainOfficeAddress: null,
    },
    technicalManager: bundIdPerson,
    additionalShareholders,
  };
}
