import { Answers, ShAnswers, ShUser } from '@startuphafen/startuphafen-common';
import { ServerConfig } from '../../config';
import { XMLBuilderTool } from './xml-builder';

describe('XMLBuilderTool', () => {
  let xmlBuilder: XMLBuilderTool;

  beforeEach(() => {
    // Create a dummy server config object
    const dummyServerConfig: ServerConfig = {
      express: {
        host: '127.0.0.1',
        port: 3000,
      },
      knex: {
        client: 'pg',
        connection: {
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          database: 'test',
          password: 'password',
        },
        asyncStackTraces: true,
      },
      mail: {
        host: 'smtp.example.com',
        port: 587,
        user: 'user',
        password: 'password',
        from: 'test@example.com',
      },
      allowedOrigins: ['http://localhost:4200'],
      keycloak: {
        host: 'test',
        user: 'test',
        password: 'test',
        jwksUri: 'test',
      },
      watermarkConfig: {
        text: 'TEST',
      },
      dbMigration: {
        migrationsDirectory: './migrations',
      },
      eric: {
        devMode: true,
      },
    };

    xmlBuilder = new XMLBuilderTool(
      {
        strapi: { host: '', token: '' },
        eric: { host: '', token: '', finanzAmtId: 'Test121212Test' },
        ozg: {
          host: '',
          control: {
            zustaendigeStelle: '',
            leikaIds: [],
            formId: '',
            name: '',
            serviceKonto: {
              type: '',
              trustLevel: '',
              postfachAddress: {
                identifier: '',
                type: '',
              },
            },
          },
        },
      },
      dummyServerConfig
    );
  });

  describe('buildXML', () => {
    it('should build valid XML from answers', async () => {
      const mockAnswers: ShAnswers[] = [
        {
          key: 'SteEr_testKey',
          value: 'testValue',
          xmlKey: 'EUn/TestSection/TestKey',
          catalogueId: 'flowId1',
          strapiAnswerId: '1',
          id: 1,
          type: 'string',
          projectId: 1,
        },
        {
          key: 'SteEr_testKey',
          value: 'true',
          xmlKey: 'Umsatzsteuer/KleinunternehmerRegelung/KleinUnternUSt',
          catalogueId: 'flowId1',
          strapiAnswerId: '1',
          id: 1,
          type: 'string',
          projectId: 1,
        },
      ];

      const mockUser: ShUser = {
        id: '1',
        academicTitle: 'Prof. Dr.',
        city: 'Berlin',
        country: 'Deutschland',
        dateOfBirth: '2001-01-01',
        firstName: 'Nele',
        lastName: 'Mustermann',
        name: 'Nele Mustermann',
        postalCode: '12345',
        roles: ['login'],
        street: 'Musterstraße 1',
        title: 'Frau',
        cellPhoneNumber: '123456789',
        phoneNumber: '987654321',
        email: 'test@test.org',
      };

      const result = await xmlBuilder.buildXML(mockAnswers, mockUser);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain(
        '<Elster xmlns="http://www.elster.de/elsterxml/schema/v11">'
      );
      expect(result).toContain('<TestKey>');
    });
  });

  describe('fillStructure', () => {
    it('should create correct nested structure from xmlKey path', () => {
      const mockAnswers: Answers[] = [
        {
          key: 'SteEr_gewinnermittlung',
          value: 'Einnahmeüberschussrechnung',
          xmlKey: 'EUn/GewinnErmittlgsAngaben/GewinnErmittlung',
          flowId: 'flowId1',
          id: 2,
          strapiAnswerId: 1,
          type: 'string',
          projectId: 1,
        },
      ];

      const result = (xmlBuilder as any).fillStructure(mockAnswers);

      expect(result.EUn).toHaveProperty('GewinnErmittlgsAngaben');
      expect(result.EUn.GewinnErmittlgsAngaben).toHaveProperty(
        'GewinnErmittlung',
        '01'
      );
    });
  });

  describe('sanatizeValues', () => {
    it('should format dates correctly', () => {
      const result = (xmlBuilder as any).sanatizeValues('2023-01-01', 'GebDat');
      expect(result).toBe('20230101');
    });

    it('should map GewinnErmittlung values correctly', () => {
      const result = (xmlBuilder as any).sanatizeValues(
        'Einnahmeüberschussrechnung',
        'GewinnErmittlung'
      );
      expect(result).toBe('01');
    });

    it('should map Religion values correctly', () => {
      const result = (xmlBuilder as any).sanatizeValues(
        'Evangelisch',
        'Religion'
      );
      expect(result).toBe('02');
    });

    it('should set EntsprichtWohnanschrift to "true"', () => {
      const result = (xmlBuilder as any).sanatizeValues(
        'any value',
        'EntsprichtWohnanschrift'
      );
      expect(result).toBe('true');
    });
  });

  describe('fillDefaults', () => {
    it('should add default Inhaber information', async () => {
      const emptyObj = {
        Umsatzsteuer: { KleinunternehmerRegelung: { KleinUnternUSt: 'true' } },
      };
      const mockAnswers: ShAnswers[] = [
        {
          key: 'SteEr_gewinnermittlung',
          value: 'Einnahmeüberschussrechnung',
          xmlKey: 'EUn/GewinnErmittlgsAngaben/GewinnErmittlung',
          catalogueId: 'flowId1',
          id: 2,
          strapiAnswerId: '1',
          type: 'string',
          projectId: 1,
        },
      ];

      const mockUser: ShUser = {
        id: '1',
        academicTitle: 'Prof. Dr.',
        city: 'Berlin',
        country: 'Deutschland',
        dateOfBirth: '2001-01-01',
        firstName: 'Nele',
        lastName: 'Mustermann',
        name: 'Nele Mustermann',
        postalCode: '12345',
        roles: ['login'],
        street: 'Musterstraße 1',
        title: 'Frau',
        cellPhoneNumber: '123456789',
        phoneNumber: '987654321',
        email: 'test@test.org',
      };

      const result = await xmlBuilder.fillDefaults(
        emptyObj as any,
        mockAnswers,
        mockUser
      );

      expect(result).toHaveProperty('Ordnungskriterium');
      expect(result.Ordnungskriterium).toHaveProperty('OrdNrArt');
      expect(result.Ordnungskriterium).toMatchObject({ OrdNrArt: 'O' });
    });
  });

  describe('filterXmlKeys', () => {
    it('should return path array for valid SteEr keys', () => {
      const mockAnswer: Answers = {
        key: 'SteEr_testKey',
        value: 'testValue',
        xmlKey: 'Path/To/Value',
        strapiAnswerId: 1,
        flowId: 'flowId1',
        type: 'string',
        id: 1,
        projectId: 1,
      };

      const result = (xmlBuilder as any).filterXmlKeys(mockAnswer);
      expect(result).toEqual(['Path', 'To', 'Value']);
    });

    it('should return undefined for non-SteEr keys', () => {
      const mockAnswer: Answers = {
        key: 'GewA_key',
        value: 'testValue',
        xmlKey: 'Path/To/Value',
        type: 'string',
        strapiAnswerId: 1,
        flowId: 'flowId1',
        id: 1,
        projectId: 1,
      };

      const result = (xmlBuilder as any).filterXmlKeys(mockAnswer);
      expect(result).toBeUndefined();
    });
  });

  describe('fillDefaults with address parsing', () => {
    it('should correctly parse user address with numeric house number for fillDefaults', async () => {
      // Create minimal object to test address parsing
      const emptyObj = {
        Umsatzsteuer: { KleinunternehmerRegelung: { KleinUnternUSt: 'true' } },
      };

      // Answer that triggers address parsing
      const mockAnswers: ShAnswers[] = [
        {
          key: 'SteEr68-75',
          value: 'Entspricht meiner privaten Adresse',
          xmlKey: 'EUn/Inhaber/NatPers/Adrkette/StrAdr',
          catalogueId: 'flowId1',
          id: 2,
          strapiAnswerId: '1',
          type: 'string',
          projectId: 1,
        },
      ];

      // Test with a simple numeric house number
      const mockUser: ShUser = {
        id: '1',
        academicTitle: 'Dr.',
        city: 'Hamburg',
        country: 'Deutschland',
        dateOfBirth: '1980-01-01',
        firstName: 'Max',
        lastName: 'Mustermann',
        name: 'Max Mustermann',
        postalCode: '20095',
        roles: ['login'],
        street: 'Hafenstraße 42', // Simple numeric case
        title: 'Herr',
        cellPhoneNumber: '123456789',
        phoneNumber: '987654321',
        email: 'test@example.org',
      };

      const result = await xmlBuilder.fillDefaults(
        emptyObj as any,
        mockAnswers,
        mockUser
      );

      // Check that street was parsed correctly
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.Str).toBe(
        'Hafenstraße'
      );
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNr).toBe('42');
      expect(
        result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNrZu
      ).toBeUndefined();
    });
  });

  describe('fillDefaults with address parsing', () => {
    it('should correctly put pure numeric house number in HausNr field', async () => {
      // Create minimal object to test address parsing
      const emptyObj = {
        Umsatzsteuer: { KleinunternehmerRegelung: { KleinUnternUSt: 'true' } },
      };

      // Answer that triggers address parsing
      const mockAnswers: ShAnswers[] = [
        {
          key: 'SteEr68-75',
          value: 'Entspricht meiner privaten Adresse',
          xmlKey: 'EUn/Inhaber/NatPers/Adrkette/StrAdr',
          catalogueId: 'flowId1',
          id: 2,
          strapiAnswerId: '1',
          type: 'string',
          projectId: 1,
        },
      ];

      // Test with a simple numeric house number
      const mockUser: ShUser = {
        id: '1',
        academicTitle: 'Dr.',
        city: 'Hamburg',
        country: 'Deutschland',
        dateOfBirth: '1980-01-01',
        firstName: 'Max',
        lastName: 'Mustermann',
        name: 'Max Mustermann',
        postalCode: '20095',
        roles: ['login'],
        street: 'Hafenstraße 42', // Simple numeric case
        title: 'Herr',
        cellPhoneNumber: '123456789',
        phoneNumber: '987654321',
        email: 'test@example.org',
      };

      const result = await xmlBuilder.fillDefaults(
        emptyObj as any,
        mockAnswers,
        mockUser
      );

      // Check that the numeric house number is in HausNr field
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.Str).toBe(
        'Hafenstraße'
      );
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNr).toBe('42');
      expect(
        result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNrZu
      ).toBeUndefined();
    });

    it('should correctly put house number with letter suffix in HausNrZu field', async () => {
      // Create minimal object to test address parsing
      const emptyObj = {
        Umsatzsteuer: { KleinunternehmerRegelung: { KleinUnternUSt: 'true' } },
      };

      // Answer that triggers address parsing
      const mockAnswers: ShAnswers[] = [
        {
          key: 'SteEr68-75',
          value: 'Entspricht meiner privaten Adresse',
          xmlKey: 'EUn/Inhaber/NatPers/Adrkette/StrAdr',
          catalogueId: 'flowId1',
          id: 2,
          strapiAnswerId: '1',
          type: 'string',
          projectId: 1,
        },
      ];

      // Test with a house number with letter suffix
      const mockUser: ShUser = {
        id: '1',
        academicTitle: 'Dr.',
        city: 'Hamburg',
        country: 'Deutschland',
        dateOfBirth: '1980-01-01',
        firstName: 'Max',
        lastName: 'Mustermann',
        name: 'Max Mustermann',
        postalCode: '20095',
        roles: ['login'],
        street: 'Karlstraße 15b', // House number with letter
        title: 'Herr',
        cellPhoneNumber: '123456789',
        phoneNumber: '987654321',
        email: 'test@example.org',
      };

      const result = await xmlBuilder.fillDefaults(
        emptyObj as any,
        mockAnswers,
        mockUser
      );

      // Check that the alphanumeric house number is in HausNrZu field
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.Str).toBe('Karlstraße');
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNr).toBeUndefined();
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNrZu).toBe('15b');
    });

    it('should correctly put house number with range in HausNrZu field', async () => {
      // Create minimal object to test address parsing
      const emptyObj = {
        Umsatzsteuer: { KleinunternehmerRegelung: { KleinUnternUSt: 'true' } },
      };

      // Answer that triggers address parsing
      const mockAnswers: ShAnswers[] = [
        {
          key: 'SteEr68-75',
          value: 'Entspricht meiner privaten Adresse',
          xmlKey: 'EUn/Inhaber/NatPers/Adrkette/StrAdr',
          catalogueId: 'flowId1',
          id: 2,
          strapiAnswerId: '1',
          type: 'string',
          projectId: 1,
        },
      ];

      // Test with a complex address with range
      const mockUser: ShUser = {
        id: '1',
        academicTitle: 'Dr.',
        city: 'Hamburg',
        country: 'Deutschland',
        dateOfBirth: '1980-01-01',
        firstName: 'Max',
        lastName: 'Mustermann',
        name: 'Max Mustermann',
        postalCode: '20095',
        roles: ['login'],
        street: 'Hafen Str. 2a-2f', // Complex case with range
        title: 'Herr',
        cellPhoneNumber: '123456789',
        phoneNumber: '987654321',
        email: 'test@example.org',
      };

      const result = await xmlBuilder.fillDefaults(
        emptyObj as any,
        mockAnswers,
        mockUser
      );

      // Check that the complex house number is in HausNrZu field
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.Str).toBe('Hafen Str.');
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNr).toBeUndefined();
      expect(result.Inhaber?.NatPers?.Adrkette?.StrAdr?.HausNrZu).toBe('2a-2f');
    });
  });
});

import { parseStreetAddress } from './xml-builder';

describe('parseStreetAddress', () => {
  it('should correctly parse simple street with numeric house number', () => {
    const result = parseStreetAddress('Hauptstraße 1');
    expect(result).toEqual({
      streetName: 'Hauptstraße',
      houseNumber: '1',
      hasNonNumericPart: false,
    });
  });

  it('should correctly parse street with house number and letter suffix', () => {
    const result = parseStreetAddress('Hafenallee 15c');
    expect(result).toEqual({
      streetName: 'Hafenallee',
      houseNumber: '15c',
      hasNonNumericPart: true,
    });
  });

  it('should correctly parse hyphenated street names with numeric house number', () => {
    const result = parseStreetAddress('Ludwig-Bach Straße 148');
    expect(result).toEqual({
      streetName: 'Ludwig-Bach Straße',
      houseNumber: '148',
      hasNonNumericPart: false,
    });
  });

  it('should correctly parse street names with abbreviations and alphanumeric house number', () => {
    const result = parseStreetAddress('August Bebel Str. 3a');
    expect(result).toEqual({
      streetName: 'August Bebel Str.',
      houseNumber: '3a',
      hasNonNumericPart: true,
    });
  });

  it('should correctly parse street with house number range with dash', () => {
    const result = parseStreetAddress('Parkweg 21-30');
    expect(result).toEqual({
      streetName: 'Parkweg',
      houseNumber: '21-30',
      hasNonNumericPart: true,
    });
  });

  it('should correctly parse street with complex house number range', () => {
    const result = parseStreetAddress('Düsternstrasse 2a-2f');
    expect(result).toEqual({
      streetName: 'Düsternstrasse',
      houseNumber: '2a-2f',
      hasNonNumericPart: true,
    });
  });

  it('should return empty house number when no house number is found', () => {
    const result = parseStreetAddress('Milastraße');
    expect(result).toEqual({
      streetName: 'Milastraße',
      houseNumber: '',
      hasNonNumericPart: false,
    });
  });

  it('should handle multiple spaces between street name and house number', () => {
    const result = parseStreetAddress('Ringstraße    42');
    expect(result).toEqual({
      streetName: 'Ringstraße',
      houseNumber: '42',
      hasNonNumericPart: false,
    });
  });
});
