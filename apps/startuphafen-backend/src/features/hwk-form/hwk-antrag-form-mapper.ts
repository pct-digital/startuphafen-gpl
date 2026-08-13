import {
  AddressLike,
  AntragFormFields,
  buildFullName,
  formatAddressLine,
  formatGermanDate,
  formatPostalLine,
  formatStreetLine,
  HwkFormData,
  HwkFormShareholder,
  NOT_APPLICABLE,
} from '@startuphafen/startuphafen-common';

export function mapHwkFormDataToAntragFormFields(
  data: HwkFormData
): Partial<AntragFormFields> {
  const fields: Partial<AntragFormFields> = {};

  const entryType = data.entryType ?? null;
  if (entryType != null) {
    const normalizedEntryType = normalizeText(entryType);
    fields.entry_handwerksrolle_checkbox =
      normalizedEntryType === 'handwerksrolle';
    fields.entry_zulassungsfreie_checkbox =
      normalizedEntryType ===
      'verzeichnis der zulassungsfreien handwerksbetriebe';
    fields.entry_handwerksaehnliche_checkbox =
      normalizedEntryType ===
      'verzeichnis der handwerksaehnlichen gewerbebetriebe';
  }

  if (data.owner.isCompany) {
    // The first Anteilseigner is a company (KAPG). A company has no personal
    // attributes, so the text fields show a dash and the gender checkboxes stay
    // unchecked, mirroring how a company is rendered in person b).
    if (data.owner.companyName) {
      fields.person_a_name = data.owner.companyName;
    }
    fields.person_a_birth_date = NOT_APPLICABLE;
    fields.person_a_birth_place = NOT_APPLICABLE;
    fields.person_a_nationality = NOT_APPLICABLE;
  } else {
    const ownerFullName = buildFullName(
      data.owner.firstName,
      data.owner.lastName
    );
    if (ownerFullName) {
      fields.person_a_name = ownerFullName;
    }

    const ownerBirthDate = formatGermanDate(data.owner.birthDate);
    if (ownerBirthDate) {
      fields.person_a_birth_date = ownerBirthDate;
    }

    if (data.owner.nationality) {
      fields.person_a_nationality = data.owner.nationality;
    }

    if (data.owner.birthPlace) {
      fields.person_a_birth_place = data.owner.birthPlace;
    }

    const ownerGender = normalizeText(data.owner.gender ?? '');
    if (ownerGender === 'maennlich') {
      fields.person_a_gender_male_checkbox = true;
      fields.person_a_gender_female_checkbox = false;
    } else if (ownerGender === 'weiblich') {
      fields.person_a_gender_male_checkbox = false;
      fields.person_a_gender_female_checkbox = true;
    }
  }

  const ownerAddressLine = formatAddressLine({
    street: data.owner.address.street,
    houseNumber: data.owner.address.houseNumber,
    addressExtra: data.owner.address.addressExtra,
    postalCode: data.owner.address.postalCode,
    city: data.owner.address.city,
  });
  if (ownerAddressLine) {
    fields.person_a_address = ownerAddressLine;
  }

  // The first additional shareholder fills person b); shareholders beyond that
  // are rendered onto the generated extra page (see hwk-form-pdf-service).
  const secondPerson = data.additionalShareholders?.[0];
  if (secondPerson) {
    applyPersonBFields(fields, secondPerson);
  }

  const legalForm = data.legalForm?.trim() ?? '';
  if (legalForm) {
    const normalizedLegalForm = normalizeText(legalForm);
    const collapsedLegalForm = normalizedLegalForm.replace(/[\s&]/g, '');

    fields.legal_form_einzelunternehmen_checkbox = false;
    fields.legal_form_gbr_checkbox = false;
    fields.legal_form_ohg_checkbox = false;
    fields.legal_form_gmbh_checkbox = false;
    fields.legal_form_gmbh_co_kg_checkbox = false;
    fields.legal_form_kg_checkbox = false;
    fields.legal_form_ag_checkbox = false;
    fields.legal_form_ug_checkbox = false;
    fields.legal_form_other_checkbox = false;

    if (normalizedLegalForm === 'einzelunternehmen') {
      fields.legal_form_einzelunternehmen_checkbox = true;
    } else if (
      normalizedLegalForm === 'gbr' ||
      normalizedLegalForm.includes('gesellschaft buergerlichen rechts')
    ) {
      fields.legal_form_gbr_checkbox = true;
    } else if (
      normalizedLegalForm === 'ohg' ||
      normalizedLegalForm.includes('offene handelsgesellschaft')
    ) {
      fields.legal_form_ohg_checkbox = true;
    } else if (
      collapsedLegalForm.includes('gmbhco') &&
      collapsedLegalForm.includes('kg')
    ) {
      fields.legal_form_gmbh_co_kg_checkbox = true;
    } else if (normalizedLegalForm === 'gmbh') {
      fields.legal_form_gmbh_checkbox = true;
    } else if (normalizedLegalForm === 'kg') {
      fields.legal_form_kg_checkbox = true;
    } else if (normalizedLegalForm === 'ag') {
      fields.legal_form_ag_checkbox = true;
    } else if (normalizedLegalForm.startsWith('ug')) {
      fields.legal_form_ug_checkbox = true;
    } else {
      fields.legal_form_other_checkbox = true;
      fields.legal_form_other = legalForm;
    }
  }

  if (data.handelsregister.registered === true) {
    fields.commercial_register_yes_checkbox = true;
    fields.commercial_register_no_checkbox = false;
  } else if (data.handelsregister.registered === false) {
    fields.commercial_register_yes_checkbox = false;
    fields.commercial_register_no_checkbox = true;
  }

  if (data.handelsregister.companyName) {
    fields.commercial_register_company_name = data.handelsregister.companyName;
  }

  fields.reason_new_foundation_checkbox = true;
  fields.reason_succession_checkbox = false;
  fields.reason_change_legal_form_checkbox = false;
  fields.reason_business_expansion_checkbox = false;

  const businessLocation: AddressLike = {
    street: data.businessLocation.street,
    houseNumber: data.businessLocation.houseNumber,
    addressExtra: data.businessLocation.addressExtra,
    postalCode: data.businessLocation.postalCode,
    city: data.businessLocation.city,
  };

  const businessStreetLine = formatStreetLine(businessLocation);
  if (businessStreetLine) {
    fields.business_address_street = businessStreetLine;
  }

  const businessPostalLine = formatPostalLine(businessLocation);
  if (businessPostalLine) {
    fields.business_postcode_city = businessPostalLine;
  }

  if (data.businessLocation.phone) {
    fields.business_phone = data.businessLocation.phone;
  }
  if (data.businessLocation.mobile) {
    fields.business_mobile = data.businessLocation.mobile;
  }
  if (data.businessLocation.fax) {
    fields.business_fax = data.businessLocation.fax;
  }

  const businessEmail = data.businessLocation.email ?? data.owner.email ?? null;
  if (businessEmail) {
    fields.business_email = businessEmail;
  }

  if (data.businessLocation.internet) {
    fields.business_internet = data.businessLocation.internet;
  }

  if (data.businessLocation.deliveryAddress) {
    fields.business_mailing_address = data.businessLocation.deliveryAddress;
  }

  if (data.business.name) {
    fields.company_name = data.business.name;
  }

  const businessStartDate = formatGermanDate(data.business.startDate);
  if (businessStartDate) {
    fields.business_start_date = businessStartDate;
  }

  fields.main_business_checkbox = true;
  fields.branch_checkbox = false;

  if (data.businessLocation.mainOfficeAddress) {
    fields.main_business_address = data.businessLocation.mainOfficeAddress;
  }

  if (data.tradeDescription) {
    const tradeLines = splitTextLines(data.tradeDescription, 3);
    if (tradeLines[0]) fields.trades_line1 = tradeLines[0];
    if (tradeLines[1]) fields.trades_line2 = tradeLines[1];
    if (tradeLines[2]) fields.trades_line3 = tradeLines[2];
  }

  const managerFullName = buildFullName(
    data.technicalManager.firstName,
    data.technicalManager.lastName
  );
  if (managerFullName) {
    fields.manager_name = managerFullName;
  }

  if (data.technicalManager.nationality) {
    fields.manager_nationality = data.technicalManager.nationality;
  }

  const managerStreetLine = formatStreetLine({
    street: data.technicalManager.address.street,
    houseNumber: data.technicalManager.address.houseNumber,
    addressExtra: data.technicalManager.address.addressExtra,
    postalCode: data.technicalManager.address.postalCode,
    city: data.technicalManager.address.city,
  });
  if (managerStreetLine) {
    fields.manager_street = managerStreetLine;
  }

  const managerPostalLine = formatPostalLine({
    street: data.technicalManager.address.street,
    houseNumber: data.technicalManager.address.houseNumber,
    addressExtra: data.technicalManager.address.addressExtra,
    postalCode: data.technicalManager.address.postalCode,
    city: data.technicalManager.address.city,
  });
  if (managerPostalLine) {
    fields.manager_postcode_city = managerPostalLine;
  }

  const managerBirthDate = formatGermanDate(data.technicalManager.birthDate);
  if (managerBirthDate) {
    fields.manager_birth_date = managerBirthDate;
  }

  if (data.technicalManager.birthPlace) {
    fields.manager_birth_place = data.technicalManager.birthPlace;
  }

  if (data.technicalManager.phone) {
    fields.manager_phone = data.technicalManager.phone;
  }

  if (data.technicalManager.mobile) {
    fields.manager_mobile = data.technicalManager.mobile;
  }

  if (data.technicalManager.email) {
    fields.manager_email = data.technicalManager.email;
  }

  if (data.technicalManager.internet) {
    fields.manager_internet = data.technicalManager.internet;
  }

  const qualificationExamDate = formatGermanDate(data.qualification.examDate);
  if (qualificationExamDate) {
    fields.exam_date = qualificationExamDate;
  }

  if (data.qualification.examPlace) {
    fields.exam_location = data.qualification.examPlace;
  }

  if (data.qualification.trade) {
    fields.exam_trade = data.qualification.trade;
  }

  if (data.qualification.trainingPermit === true) {
    fields.training_authorization_yes_checkbox = true;
    fields.training_authorization_no_checkbox = false;
  } else if (data.qualification.trainingPermit === false) {
    fields.training_authorization_yes_checkbox = false;
    fields.training_authorization_no_checkbox = true;
  }

  if (data.priorBusiness.hasPrior === true) {
    fields.previous_business_yes_checkbox = true;
    fields.previous_business_no_checkbox = false;
  } else if (data.priorBusiness.hasPrior === false) {
    fields.previous_business_yes_checkbox = false;
    fields.previous_business_no_checkbox = true;
  }

  if (data.priorBusiness.details) {
    const priorBusinessLines = splitTextLines(data.priorBusiness.details, 2);
    if (priorBusinessLines[0]) {
      fields.previous_business_details_line1 = priorBusinessLines[0];
    }
    if (priorBusinessLines[1]) {
      fields.previous_business_details_line2 = priorBusinessLines[1];
    }
  }

  if (data.business.relocationFrom) {
    fields.relocation_from_address = data.business.relocationFrom;
    fields.relocation_checkbox = true;
  }

  if (data.business.takeoverFrom) {
    fields.predecessor_name_address = data.business.takeoverFrom;
    fields.takeover_checkbox = true;
  }

  return fields;
}

function applyPersonBFields(
  fields: Partial<AntragFormFields>,
  shareholder: HwkFormShareholder
): void {
  const name = shareholder.isCompany
    ? shareholder.companyName
    : buildFullName(shareholder.firstName, shareholder.lastName);
  if (name) {
    fields.person_b_name = name;
  }

  if (shareholder.isCompany) {
    // A company has no personal attributes. Fill the text fields with a dash so
    // it is clear nothing can be entered there (the gender checkboxes simply
    // stay unchecked).
    fields.person_b_birth_date = NOT_APPLICABLE;
    fields.person_b_birth_place = NOT_APPLICABLE;
    fields.person_b_nationality = NOT_APPLICABLE;
  } else {
    const birthDate = formatGermanDate(shareholder.birthDate);
    if (birthDate) {
      fields.person_b_birth_date = birthDate;
    }

    if (shareholder.nationality) {
      fields.person_b_nationality = shareholder.nationality;
    }

    if (shareholder.birthPlace) {
      fields.person_b_birth_place = shareholder.birthPlace;
    }

    const gender = normalizeText(shareholder.gender ?? '');
    if (gender === 'maennlich') {
      fields.person_b_gender_male_checkbox = true;
      fields.person_b_gender_female_checkbox = false;
    } else if (gender === 'weiblich') {
      fields.person_b_gender_male_checkbox = false;
      fields.person_b_gender_female_checkbox = true;
    }
  }

  const addressLine = formatAddressLine({
    street: shareholder.address.street,
    houseNumber: shareholder.address.houseNumber,
    addressExtra: shareholder.address.addressExtra,
    postalCode: shareholder.address.postalCode,
    city: shareholder.address.city,
  });
  if (addressLine) {
    fields.person_b_address = addressLine;
  }
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTextLines(value: string, maxLines: number): string[] {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const rawLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length <= maxLines) {
    return rawLines;
  }

  const lines = rawLines.slice(0, maxLines);
  lines[maxLines - 1] = [lines[maxLines - 1], ...rawLines.slice(maxLines)]
    .join(' ')
    .trim();
  return lines;
}
