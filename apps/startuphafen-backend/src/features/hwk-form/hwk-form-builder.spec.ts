import {
  Answers,
  ProfileInfo,
  Project,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { buildHwkFormData } from './hwk-form-builder';

const buildAnswer = (
  key: string,
  value: string,
  stringValue: string | null = null
): Answers => ({
  id: 1,
  projectId: 1,
  key,
  value,
  stringValue,
  type: 'string',
  xmlKey: '/',
  questionText: '',
  answerText: '',
  headerText: null,
  componentId: 'TestComponent',
});

const baseUser: ShUser = {
  id: 'user-1',
  title: 'Herr',
  academicTitle: null,
  name: null,
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max@example.com',
  phoneNumber: '040123',
  cellPhoneNumber: '0170123',
  country: 'DE',
  dateOfBirth: '1990-01-01',
  street: 'Musterstrasse 12',
  postalCode: '12345',
  city: 'Hamburg',
  roles: null,
  inboxReference: null,
  createdAt: new Date('2024-01-01'),
};

const baseProfile: ProfileInfo = {
  id: 1,
  userId: 'user-1',
  createdAt: new Date('2024-01-01'),
  phoneInternational: '+49',
  phoneNational: '40',
  phoneNumber: '040999',
  website: 'https://example.com',
  birthCountry: 'Germany',
  birthPlace: 'Hamburg',
};

describe('buildHwkFormData', () => {
  it('maps EUN data including HWK answers', () => {
    const project: Project = {
      createdAt: new Date(),
      id: 1,
      userId: 'user-1',
      name: 'Testprojekt',
      catalogueId: 'eun',
      progress: 0,
      lastPosition: 0,
      stSent: false,
      gwSent: false,
    };

    const answers: Answers[] = [
      buildAnswer('HwkEntryType', 'hwkEntryAns-1', 'Handwerksrolle'),
      buildAnswer('HwkTrade', 'Maler- und Lackiererhandwerk'),
      buildAnswer('HwkQualificationDate', '2020-01-01'),
      buildAnswer('HwkQualificationPlace', 'Hamburg'),
      buildAnswer('HwkQualificationTrade', 'Maler'),
      buildAnswer('HwkQualificationTrainingPermit', 'hwkQualTrain-1', 'true'),
      buildAnswer('HwkPriorBusiness', 'hwkPrior-2', 'false'),
      buildAnswer('St68', 'st68Ans-1', 'true'),
      buildAnswer('St96', '2024-02-01'),
    ];

    const result = buildHwkFormData({
      answers,
      project,
      user: baseUser,
      profileInfo: baseProfile,
    });

    expect(result.entryType).toBe('Handwerksrolle');
    expect(result.tradeDescription).toBe('Maler- und Lackiererhandwerk');
    expect(result.qualification.trainingPermit).toBe(true);
    expect(result.priorBusiness.hasPrior).toBe(false);
    expect(result.business.name).toBe('Testprojekt');
    expect(result.business.startDate).toBe('2024-02-01');
    expect(result.owner.firstName).toBe('Max');
    expect(result.owner.birthPlace).toBe('Hamburg');
    expect(result.technicalManager.birthPlace).toBe('Hamburg');
    expect(result.businessLocation.street).toBe('Musterstrasse');
    expect(result.businessLocation.houseNumber).toBe('12');
    expect(result.businessLocation.email).toBe('max@example.com');
  });

  it('merges EUN business house number suffix when using other address', () => {
    const project: Project = {
      createdAt: new Date(),
      id: 3,
      userId: 'user-1',
      name: 'Testprojekt',
      catalogueId: 'eun',
      progress: 0,
      lastPosition: 0,
      stSent: false,
      gwSent: false,
    };

    const answers: Answers[] = [
      buildAnswer('St68', 'st68Ans-2'),
      buildAnswer('St69', 'Musterweg'),
      buildAnswer('St70a', '12'),
      buildAnswer('St70b', 'a'),
      buildAnswer('St70c', 'Hinterhaus'),
      buildAnswer('St71a', '12345'),
      buildAnswer('St71b', 'Hamburg'),
    ];

    const result = buildHwkFormData({
      answers,
      project,
      user: baseUser,
      profileInfo: baseProfile,
    });

    expect(result.businessLocation.street).toBe('Musterweg');
    expect(result.businessLocation.houseNumber).toBe('12a');
    expect(result.businessLocation.addressExtra).toBe('Hinterhaus');
  });

  it('maps KAPG legal form and sources the applicant (owner) from BundID', () => {
    const project: Project = {
      createdAt: new Date(),
      id: 2,
      userId: 'user-1',
      name: 'Kapg Projekt',
      catalogueId: 'kapg',
      progress: 0,
      lastPosition: 0,
      stSent: false,
      gwSent: false,
    };

    const answers: Answers[] = [
      buildAnswer('St74', 'st74Ans-2', '370'),
      buildAnswer('St3', 'Kapg GmbH'),
      buildAnswer('St77', '2024-03-01'),
      buildAnswer('St12b', '040'),
      buildAnswer('St12c', '123456'),
      buildAnswer('St14', 'https://kapg.example'),
    ];

    const result = buildHwkFormData({
      answers,
      project,
      user: baseUser,
      profileInfo: baseProfile,
    });

    expect(result.legalForm).toBe('UG (haftungsbeschränkt)');
    // The applicant / first shareholder (person a) is the BundID user; the
    // St29 "Gesetzlicher Vertreter" step is not part of the KAPG flow.
    expect(result.owner.isCompany).toBe(false);
    expect(result.owner.firstName).toBe('Max');
    expect(result.owner.lastName).toBe('Mustermann');
    expect(result.owner.birthPlace).toBe('Hamburg');
    expect(result.technicalManager.firstName).toBe('Max');
    expect(result.business.name).toBe('Kapg GmbH');
    expect(result.businessLocation.phone).toBe('040 123456');
    expect(result.additionalShareholders).toEqual([]);
  });

  it('treats the first KAPG Anteilseigner (applicant) as owner and the rest as additional', () => {
    const project: Project = {
      createdAt: new Date(),
      id: 6,
      userId: 'user-1',
      name: 'Kapg Projekt',
      catalogueId: 'kapg',
      progress: 0,
      lastPosition: 0,
      stSent: false,
      gwSent: false,
    };

    const answers: Answers[] = [
      // Shareholder 0: the applicant (natural person). Its personal fields are
      // not collected in the form - they come from BundID - so only the marker
      // and type are present here.
      buildAnswer('St81_0', '1'),
      buildAnswer('Us4_0', 'us4_0Ans-2'),
      // Shareholder 1: natural person (a real co-owner with full data)
      buildAnswer('St81_1', '2'),
      buildAnswer('Us4_1', 'us4_1Ans-2'),
      buildAnswer('St83b_1', 'Schmidt'),
      buildAnswer('St83d_1', 'Anna'),
      buildAnswer('St83f_1', '1980-04-15'),
      buildAnswer('GwGeschlecht_1', 'GwGeschlecht_1Ans-2', 'weiblich'),
      buildAnswer('GwGeburtsort_1', 'Lübeck'),
      buildAnswer('GwStaat_1', 'DE'),
      buildAnswer('St83h_1', 'Anteilsweg'),
      buildAnswer('St83i_1', '7'),
      buildAnswer('St83j_1', 'b'),
      buildAnswer('St83l_1', '23552'),
      buildAnswer('St83m_1', 'Lübeck'),
      // Shareholder 2: company
      buildAnswer('St81_2', '3'),
      buildAnswer('Us4_2', 'us4_2Ans-1'),
      buildAnswer('St82a_2', 'Beispiel Holding GmbH'),
      buildAnswer('St82c_2', 'Firmenstraße'),
      buildAnswer('St82d_2', '1'),
      buildAnswer('St82g_2', '20095'),
      buildAnswer('St82h_2', 'Hamburg'),
    ];

    const result = buildHwkFormData({
      answers,
      project,
      user: baseUser,
      profileInfo: baseProfile,
    });

    // person a) = the applicant, from BundID
    expect(result.owner.isCompany).toBe(false);
    expect(result.owner.firstName).toBe('Max');
    expect(result.owner.lastName).toBe('Mustermann');

    // person b) + extra page = shareholders 1 and 2
    expect(result.additionalShareholders).toHaveLength(2);
    const [person, company] = result.additionalShareholders ?? [];
    expect(person.isCompany).toBe(false);
    expect(person.firstName).toBe('Anna');
    expect(person.lastName).toBe('Schmidt');
    expect(person.birthDate).toBe('1980-04-15');
    expect(person.gender).toBe('weiblich');
    expect(person.birthPlace).toBe('Lübeck');
    expect(person.nationality).toBe('DE');
    expect(person.address.houseNumber).toBe('7b');

    expect(company.isCompany).toBe(true);
    expect(company.companyName).toBe('Beispiel Holding GmbH');
    expect(company.gender).toBeNull();
    expect(company.address.street).toBe('Firmenstraße');
    expect(company.address.city).toBe('Hamburg');
  });

  it('uses the first KAPG Anteilseigner as owner when it is a company', () => {
    const project: Project = {
      createdAt: new Date(),
      id: 8,
      userId: 'user-1',
      name: 'Kapg Projekt',
      catalogueId: 'kapg',
      progress: 0,
      lastPosition: 0,
      stSent: false,
      gwSent: false,
    };

    const answers: Answers[] = [
      // Shareholder 0: the applicant declared the first Anteilseigner is a Firma
      buildAnswer('St81_0', '1'),
      buildAnswer('Us4_0', 'us4_0Ans-1'),
      buildAnswer('St82a_0', 'Gründer Holding GmbH'),
      buildAnswer('St82c_0', 'Holdingweg'),
      buildAnswer('St82d_0', '2'),
      buildAnswer('St82g_0', '20095'),
      buildAnswer('St82h_0', 'Hamburg'),
      // Shareholder 1: natural person
      buildAnswer('St81_1', '2'),
      buildAnswer('Us4_1', 'us4_1Ans-2'),
      buildAnswer('St83b_1', 'Schmidt'),
      buildAnswer('St83d_1', 'Anna'),
      buildAnswer('St83f_1', '1980-04-15'),
      buildAnswer('GwGeschlecht_1', 'GwGeschlecht_1Ans-2', 'weiblich'),
      buildAnswer('GwGeburtsort_1', 'Lübeck'),
      buildAnswer('GwStaat_1', 'DE'),
      buildAnswer('St83h_1', 'Anteilsweg'),
      buildAnswer('St83i_1', '7'),
      buildAnswer('St83l_1', '23552'),
      buildAnswer('St83m_1', 'Lübeck'),
    ];

    const result = buildHwkFormData({
      answers,
      project,
      user: baseUser,
      profileInfo: baseProfile,
    });

    // person a) = the company (the first Anteilseigner)
    expect(result.owner.isCompany).toBe(true);
    expect(result.owner.companyName).toBe('Gründer Holding GmbH');
    expect(result.owner.address.street).toBe('Holdingweg');
    expect(result.owner.address.city).toBe('Hamburg');
    // The technical manager remains the BundID applicant (a natural person).
    expect(result.technicalManager.isCompany).toBe(false);
    expect(result.technicalManager.firstName).toBe('Max');

    // person b) = the second shareholder
    expect(result.additionalShareholders).toHaveLength(1);
    const [person] = result.additionalShareholders ?? [];
    expect(person.isCompany).toBe(false);
    expect(person.lastName).toBe('Schmidt');
  });
});
