import { HwkFormData } from '@startuphafen/startuphafen-common';
import { mapHwkFormDataToAntragFormFields } from './hwk-antrag-form-mapper';

describe('mapHwkFormDataToAntragFormFields', () => {
  it('maps core HWK data into PDF fields', () => {
    const owner = {
      firstName: 'Max',
      lastName: 'Mustermann',
      birthDate: '1990-01-01',
      birthPlace: null,
      nationality: 'DE',
      gender: 'männlich' as const,
      address: {
        street: 'Musterstrasse',
        houseNumber: '12',
        postalCode: '12345',
        city: 'Hamburg',
        addressExtra: null,
      },
      phone: '040 123456',
      mobile: null,
      email: 'max@example.com',
      internet: 'https://example.com',
    };

    const data: HwkFormData = {
      entryType: 'Handwerksrolle',
      tradeDescription: 'Maler- und Lackiererhandwerk',
      qualification: {
        examDate: '2020-02-03',
        examPlace: 'Hamburg',
        trade: 'Maler',
        trainingPermit: true,
      },
      priorBusiness: {
        hasPrior: false,
        details: null,
      },
      owner,
      legalForm: 'Einzelunternehmen',
      handelsregister: {
        registered: false,
        companyName: null,
      },
      business: {
        name: 'Testprojekt',
        startDate: '2024-02-01',
        establishmentType: null,
        relocationFrom: null,
        takeoverFrom: null,
      },
      businessLocation: {
        street: 'Musterstrasse',
        houseNumber: '12',
        addressExtra: null,
        postalCode: '12345',
        city: 'Hamburg',
        phone: '040 123456',
        mobile: null,
        fax: null,
        email: 'business@example.com',
        internet: 'https://business.example',
        deliveryAddress: null,
        locationType: null,
        mainOfficeAddress: null,
      },
      technicalManager: owner,
    };

    const result = mapHwkFormDataToAntragFormFields(data);

    expect(result.entry_handwerksrolle_checkbox).toBe(true);
    expect(result.entry_zulassungsfreie_checkbox).toBe(false);
    expect(result.entry_handwerksaehnliche_checkbox).toBe(false);
    expect(result.person_a_name).toBe('Max Mustermann');
    expect(result.person_a_birth_date).toBe('01.01.1990');
    expect(result.person_a_gender_male_checkbox).toBe(true);
    expect(result.person_a_gender_female_checkbox).toBe(false);
    expect(result.company_name).toBe('Testprojekt');
    expect(result.business_start_date).toBe('01.02.2024');
    expect(result.legal_form_einzelunternehmen_checkbox).toBe(true);
    expect(result.reason_new_foundation_checkbox).toBe(true);
    expect(result.reason_succession_checkbox).toBe(false);
    expect(result.reason_change_legal_form_checkbox).toBe(false);
    expect(result.reason_business_expansion_checkbox).toBe(false);
    expect(result.main_business_checkbox).toBe(true);
    expect(result.branch_checkbox).toBe(false);
    expect(result.trades_line1).toBe('Maler- und Lackiererhandwerk');
    expect(result.exam_date).toBe('03.02.2020');
    expect(result.training_authorization_yes_checkbox).toBe(true);
    expect(result.training_authorization_no_checkbox).toBe(false);
    expect(result.business_email).toBe('business@example.com');
  });

  it('maps the first additional shareholder into person b fields', () => {
    const owner = {
      firstName: 'Max',
      lastName: 'Mustermann',
      birthDate: '1990-01-01',
      birthPlace: null,
      nationality: 'DE',
      gender: 'männlich' as const,
      address: {
        street: 'Musterstrasse',
        houseNumber: '12',
        postalCode: '12345',
        city: 'Hamburg',
        addressExtra: null,
      },
      phone: null,
      mobile: null,
      email: null,
      internet: null,
    };

    const data: HwkFormData = {
      entryType: null,
      tradeDescription: null,
      qualification: {
        examDate: null,
        examPlace: null,
        trade: null,
        trainingPermit: null,
      },
      priorBusiness: { hasPrior: null, details: null },
      owner,
      legalForm: 'GbR',
      handelsregister: { registered: false, companyName: null },
      business: {
        name: 'Test GbR',
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
      technicalManager: owner,
      additionalShareholders: [
        {
          isCompany: false,
          companyName: null,
          firstName: 'Anna',
          lastName: 'Schmidt',
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
        },
        // A third shareholder belongs on the extra page, not in person b).
        {
          isCompany: true,
          companyName: 'Beispiel Holding GmbH',
          firstName: null,
          lastName: null,
          birthDate: null,
          birthPlace: null,
          nationality: null,
          gender: null,
          address: {
            street: 'Firmenstraße',
            houseNumber: '1',
            postalCode: '20095',
            city: 'Hamburg',
            addressExtra: null,
          },
        },
      ],
    };

    const result = mapHwkFormDataToAntragFormFields(data);

    expect(result.person_b_name).toBe('Anna Schmidt');
    expect(result.person_b_birth_date).toBe('15.04.1980');
    expect(result.person_b_birth_place).toBe('Lübeck');
    expect(result.person_b_nationality).toBe('DE');
    expect(result.person_b_gender_female_checkbox).toBe(true);
    expect(result.person_b_gender_male_checkbox).toBe(false);
    expect(result.person_b_address).toBe('Anteilsweg 7b, 23552 Lübeck');
    // The company shareholder must not leak into person b).
    expect(result.person_b_name).not.toContain('Beispiel Holding');
  });

  it('maps a company shareholder into person b with dashes for personal fields', () => {
    const owner = {
      firstName: 'Max',
      lastName: 'Mustermann',
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

    const data: HwkFormData = {
      entryType: null,
      tradeDescription: null,
      qualification: {
        examDate: null,
        examPlace: null,
        trade: null,
        trainingPermit: null,
      },
      priorBusiness: { hasPrior: null, details: null },
      owner,
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
      technicalManager: owner,
      additionalShareholders: [
        {
          isCompany: true,
          companyName: 'Beispiel Holding GmbH',
          firstName: null,
          lastName: null,
          birthDate: null,
          birthPlace: null,
          nationality: null,
          gender: null,
          address: {
            street: 'Firmenstraße',
            houseNumber: '1',
            postalCode: '20095',
            city: 'Hamburg',
            addressExtra: null,
          },
        },
      ],
    };

    const result = mapHwkFormDataToAntragFormFields(data);

    expect(result.person_b_name).toBe('Beispiel Holding GmbH');
    expect(result.person_b_address).toBe('Firmenstraße 1, 20095 Hamburg');
    // Personal fields cannot apply to a company, so they show a dash.
    expect(result.person_b_birth_date).toBe('-');
    expect(result.person_b_birth_place).toBe('-');
    expect(result.person_b_nationality).toBe('-');
    // Gender is a checkbox pair, so it simply stays unchecked.
    expect(result.person_b_gender_male_checkbox).toBeUndefined();
    expect(result.person_b_gender_female_checkbox).toBeUndefined();
  });

  it('maps a company owner into person a with dashes for personal fields', () => {
    const owner = {
      isCompany: true,
      companyName: 'Gründer Holding GmbH',
      firstName: null,
      lastName: null,
      birthDate: null,
      birthPlace: null,
      nationality: null,
      gender: null,
      address: {
        street: 'Holdingweg',
        houseNumber: '2',
        postalCode: '20095',
        city: 'Hamburg',
        addressExtra: null,
      },
      phone: null,
      mobile: null,
      email: null,
      internet: null,
    };

    const technicalManager = {
      firstName: 'Max',
      lastName: 'Mustermann',
      birthDate: '1990-01-01',
      birthPlace: 'Hamburg',
      nationality: 'DE',
      gender: 'männlich' as const,
      address: {
        street: 'Musterstrasse',
        houseNumber: '12',
        postalCode: '12345',
        city: 'Hamburg',
        addressExtra: null,
      },
      phone: null,
      mobile: null,
      email: 'max@example.com',
      internet: null,
    };

    const data: HwkFormData = {
      entryType: null,
      tradeDescription: null,
      qualification: {
        examDate: null,
        examPlace: null,
        trade: null,
        trainingPermit: null,
      },
      priorBusiness: { hasPrior: null, details: null },
      owner,
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
      technicalManager,
    };

    const result = mapHwkFormDataToAntragFormFields(data);

    expect(result.person_a_name).toBe('Gründer Holding GmbH');
    expect(result.person_a_address).toBe('Holdingweg 2, 20095 Hamburg');
    // Personal fields cannot apply to a company, so they show a dash.
    expect(result.person_a_birth_date).toBe('-');
    expect(result.person_a_birth_place).toBe('-');
    expect(result.person_a_nationality).toBe('-');
    // Gender is a checkbox pair, so it simply stays unchecked.
    expect(result.person_a_gender_male_checkbox).toBeUndefined();
    expect(result.person_a_gender_female_checkbox).toBeUndefined();
    // The technical manager is still the natural-person applicant.
    expect(result.manager_name).toBe('Max Mustermann');
  });

  it('forces neugruendung and hauptbetrieb even with conflicting source values', () => {
    const owner = {
      firstName: 'Lena',
      lastName: 'Beispiel',
      birthDate: '1992-05-12',
      birthPlace: 'Kiel',
      nationality: 'DE',
      gender: 'weiblich' as const,
      address: {
        street: 'Beispielweg',
        houseNumber: '4',
        postalCode: '24103',
        city: 'Kiel',
        addressExtra: null,
      },
      phone: '0431 12345',
      mobile: null,
      email: 'lena@example.com',
      internet: null,
    };

    const data: HwkFormData = {
      entryType: 'Handwerksrolle',
      tradeDescription: 'Elektrotechniker',
      qualification: {
        examDate: null,
        examPlace: null,
        trade: null,
        trainingPermit: null,
      },
      priorBusiness: {
        hasPrior: null,
        details: null,
      },
      owner,
      legalForm: 'GmbH',
      handelsregister: {
        registered: true,
        companyName: 'Lena Beispiel GmbH',
      },
      business: {
        name: 'Lena Elektro',
        startDate: '2026-01-10',
        establishmentType: 'Übernahme und Rechtsformänderung',
        relocationFrom: 'Alte Straße 1, 20095 Hamburg',
        takeoverFrom: 'Vorgaenger GmbH, Hamburg',
      },
      businessLocation: {
        street: 'Werkstraße',
        houseNumber: '9',
        addressExtra: null,
        postalCode: '24103',
        city: 'Kiel',
        phone: null,
        mobile: null,
        fax: null,
        email: null,
        internet: null,
        deliveryAddress: null,
        locationType: 'Zweigstelle',
        mainOfficeAddress: 'Hauptstraße 8, 24103 Kiel',
      },
      technicalManager: owner,
    };

    const result = mapHwkFormDataToAntragFormFields(data);

    expect(result.reason_new_foundation_checkbox).toBe(true);
    expect(result.reason_succession_checkbox).toBe(false);
    expect(result.reason_change_legal_form_checkbox).toBe(false);
    expect(result.reason_business_expansion_checkbox).toBe(false);
    expect(result.main_business_checkbox).toBe(true);
    expect(result.branch_checkbox).toBe(false);
  });
});
