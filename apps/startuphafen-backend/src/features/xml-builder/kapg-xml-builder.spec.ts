import {
  Answers,
  ProfileInfo,
  ShUser,
} from '@startuphafen/startuphafen-common';
import { ServerConfig } from '../../config';
import { KapGXMLBuilder } from './kapg-xml-builder';

describe('KapGXMLBuilder', () => {
  const makeAnswer = (overrides: Partial<Answers>, id = 1): Answers => ({
    answerText: '',
    componentId: 'St1',
    headerText: null,
    id,
    key: 'St1',
    projectId: 1,
    questionText: '',
    stringValue: null,
    type: 'text',
    value: 'value',
    xmlKey: 'KapG/AllgAngaben/Firmenname',
    ...overrides,
  });

  const serverConfig = {
    eric: {
      devMode: true,
    },
  } as unknown as ServerConfig;

  const profileInfo: ProfileInfo = {
    createdAt: new Date(),
    id: 1,
    phoneInternational: '',
    phoneNational: '',
    phoneNumber: '',
    userId: '',
    website: '',
    birthCountry: '',
    birthPlace: '',
  };

  const user = {
    firstName: 'Max',
    lastName: 'Mustermann',
    dateOfBirth: '1990-01-01',
    title: 'Herr',
    academicTitle: '',
    street: 'Musterstraße 1',
    city: 'Berlin',
    postalCode: '10115',
    email: 'max@example.com',
  } as ShUser;

  it('builds XML with defaults and sanitized dates', async () => {
    const builder = new KapGXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St10',
          key: 'St10',
          value: 'Acme GmbH',
          xmlKey: 'AllgAngaben/Firmenname',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St20',
          key: 'St20',
          value: '2023-03-01',
          xmlKey: 'LohnberechnungsStelle/BeginnLohnzahlungen',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St30',
          key: 'St30',
          value: 'true',
          xmlKey: 'Umsatzsteuer/KleinunternehmerRegelung/KleinUnternUSt',
        },
        3
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        4
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        5
      ),
    ];

    const xml = await builder.buildXML(answers, [], user, 1111, profileInfo);

    expect(xml).toContain('{{TESTMERKER}}');
    expect(xml).toContain('<FragebogenTyp>GRNDKPG</FragebogenTyp>');
    expect(xml).toContain(
      '<BeginnLohnzahlungen>01.03.2023</BeginnLohnzahlungen>'
    );
    expect(xml).toContain('<Firmenname>Acme GmbH</Firmenname>');
  });

  it('remaps legacy (pre-202401) USt, Vertreter and Anteilseigner keys', async () => {
    const builder = new KapGXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St29',
          key: 'St34b',
          value: '12345678901',
          xmlKey: 'AllgAngaben/Vertreter/Ordnungskriterium/PersIdNr',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St29',
          key: 'St35b',
          value: '1020012345678',
          xmlKey: 'AllgAngaben/Vertreter/Ordnungskriterium/StNr',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St187',
          key: 'St187a',
          value: 'true',
          stringValue: 'true',
          xmlKey: 'Umsatzsteuer/Steuerbefreiung/Merker',
        },
        3
      ),
      makeAnswer(
        {
          componentId: 'St187',
          key: 'St187c',
          value: '14',
          xmlKey: 'Umsatzsteuer/Steuerbefreiung/UStGNr',
        },
        4
      ),
      makeAnswer(
        {
          componentId: 'St187',
          key: 'St188a',
          value: 'true',
          stringValue: 'true',
          xmlKey: 'Umsatzsteuer/ErmSteuersatz/Abs1/Merker',
        },
        5
      ),
      makeAnswer(
        {
          componentId: 'St187',
          key: 'St188c',
          value: '7',
          xmlKey: 'Umsatzsteuer/ErmSteuersatz/Abs1/UStGNr',
        },
        6
      ),
      makeAnswer(
        {
          componentId: 'St187',
          key: 'St189a',
          value: 'true',
          stringValue: 'true',
          xmlKey: 'Umsatzsteuer/Durchschnittbesteuerung/Merker',
        },
        7
      ),
      makeAnswer(
        {
          componentId: 'St183',
          key: 'St183a',
          value: '30000',
          xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
        },
        8
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        9
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        10
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St82_0',
          value: '1020012345678',
          xmlKey:
            'Gesellschafter/Anteilseigner/NatPers/Ordnungskriterium/StNr',
        },
        11
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St82o_0',
          value: '12345678901',
          xmlKey:
            'Gesellschafter/Anteilseigner/NatPers/Ordnungskriterium/PersIdNr',
        },
        12
      ),
    ];

    const xml = await builder.buildXML(answers, [], user, 1111, profileInfo);

    expect(xml).toContain('<Vertreter>');
    expect(xml).toMatch(/<Vertreter>[\s\S]*<PersIdNr>12345678901<\/PersIdNr>/);
    expect(xml).toContain('<MerkerSteuerbefreiung>true</MerkerSteuerbefreiung>');
    expect(xml).toContain('<MerkerSteuersatz>true</MerkerSteuersatz>');
    expect(xml).toContain('<Abs2>');
    expect(xml).toContain('<Durchschnittssatzbesteuerung>');
    expect(xml).toContain(
      '<MerkerDurchschnittssatzbesteuerung>true</MerkerDurchschnittssatzbesteuerung>'
    );
    expect(xml).not.toContain('<Abs1>');
    expect(xml).not.toContain('<Durchschnittbesteuerung>');
    expect(xml).toMatch(/<NatPers>[\s\S]*<Ordnungskriterium>[\s\S]*<StNr>/);
    expect(xml).toMatch(
      /<NatPers>[\s\S]*<PersIdNr>12345678901<\/PersIdNr>[\s\S]*<Ordnungskriterium>/
    );
    expect(xml).not.toContain('<Ordnungskriterium><PersIdNr>12345678901');
    expect(xml).toContain(
      '<KleinUnternUStVerzicht>true</KleinUnternUStVerzicht>'
    );
  });

  it('normalizes legacy Soll-/Istversteuerung values', async () => {
    const builder = new KapGXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St183',
          key: 'St183a',
          value: '30000',
          xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St190',
          key: 'St190',
          value: 'st190Ans-1',
          stringValue: 'Sollversteuerung',
          xmlKey: 'Umsatzsteuer/SollIstVersteuerung/AuswahlSollIstVerst',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        3
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        4
      ),
    ];

    const xml = await builder.buildXML(answers, [], user, 1111, profileInfo);

    expect(xml).toContain('<AuswahlSollIstVerst>1</AuswahlSollIstVerst>');
    expect(xml).not.toContain('Sollversteuerung');
  });

  it('sets KleinUnternUStVerzicht when Umsatz is greater than 25000 and no Kleinunternehmer answer exists', async () => {
    const builder = new KapGXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St183',
          key: 'St183a',
          value: '30000',
          xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        3
      ),
    ];

    const xml = await builder.buildXML(answers, [], user, 1111, profileInfo);

    expect(xml).toContain(
      '<KleinUnternUStVerzicht>true</KleinUnternUStVerzicht>'
    );
  });

  it('rejects missing Kleinunternehmer answer when Umsatz is 25000 or less', async () => {
    const builder = new KapGXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St183',
          key: 'St183a',
          value: '25000',
          xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        3
      ),
    ];

    await expect(
      builder.buildXML(answers, [], user, 1111, profileInfo)
    ).rejects.toThrow(
      'KleinUnternUSt or KleinUnternUStVerzicht must be present'
    );
  });

  it('rejects mutually exclusive Kleinunternehmer answers', async () => {
    const builder = new KapGXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St183',
          key: 'St183a',
          value: '20000',
          xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St185',
          key: 'St185a',
          value: 'true',
          xmlKey: 'Umsatzsteuer/KleinunternehmerRegelung/KleinUnternUSt',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St185',
          key: 'St185b',
          value: 'true',
          xmlKey:
            'Umsatzsteuer/KleinunternehmerRegelung/KleinUnternUStVerzicht',
        },
        3
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        4
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        5
      ),
    ];

    await expect(
      builder.buildXML(answers, [], user, 1111, profileInfo)
    ).rejects.toThrow(
      'KleinUnternUSt and KleinUnternUStVerzicht must not both be present'
    );
  });

  describe('Komm/Tel guards (ELSTER rules Tel_vollstaendig / IntVorw_alleine)', () => {
    const telBaseAnswers = (): Answers[] => [
      makeAnswer(
        {
          componentId: 'St10',
          key: 'St10',
          value: 'Acme GmbH',
          xmlKey: 'AllgAngaben/Firmenname',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St30',
          key: 'St30',
          value: 'true',
          xmlKey: 'Umsatzsteuer/KleinunternehmerRegelung/KleinUnternUSt',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        3
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        4
      ),
    ];

    it('emits no Tel elements when the profile has no phone data', async () => {
      const builder = new KapGXMLBuilder(serverConfig);

      const xml = await builder.buildXML(
        telBaseAnswers(),
        [],
        user,
        1111,
        profileInfo // phoneNational/phoneNumber are '' in the fixture
      );

      expect(xml).not.toContain('<NatVorw>');
      expect(xml).not.toContain('<RufNr>');
      expect(xml).not.toContain('<IntVorw>');
    });

    it('keeps question-provided phone answers when the profile has no phone data', async () => {
      const builder = new KapGXMLBuilder(serverConfig);

      const answers: Answers[] = [
        ...telBaseAnswers(),
        makeAnswer(
          {
            componentId: 'St36',
            key: 'St36b',
            value: '431',
            xmlKey: 'AllgAngaben/Vertreter/Komm/Tel/NatVorw',
          },
          10
        ),
        makeAnswer(
          {
            componentId: 'St36',
            key: 'St36c',
            value: '998877',
            xmlKey: 'AllgAngaben/Vertreter/Komm/Tel/RufNr',
          },
          11
        ),
      ];

      const xml = await builder.buildXML(answers, [], user, 1111, profileInfo);

      expect(xml).toContain(
        '<Tel><IntVorw>+49</IntVorw><NatVorw>431</NatVorw><RufNr>998877</RufNr></Tel>'
      );
    });

    it('completes the Vertreter Tel block from the profile when phone data exists', async () => {
      const builder = new KapGXMLBuilder(serverConfig);

      const xml = await builder.buildXML(telBaseAnswers(), [], user, 1111, {
        ...profileInfo,
        phoneNational: '40',
        phoneNumber: '1234567',
      });

      expect(xml).toContain(
        '<Tel><IntVorw>+49</IntVorw><NatVorw>40</NatVorw><RufNr>1234567</RufNr></Tel>'
      );
    });
  });

  describe('first shareholder personal data (from user / BundID)', () => {
    const naturalPersonFirstShareholder = (): Answers[] => [
      makeAnswer(
        {
          componentId: 'St183',
          key: 'St183a',
          value: '30000',
          xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St81_0',
          value: '1',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
        },
        2
      ),
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St84a_0',
          value: '12',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
        },
        3
      ),
      // A remaining NatPers field guarantees the NatPers branch exists.
      makeAnswer(
        {
          componentId: 'St81',
          key: 'St82o_0',
          value: '12345678901',
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/PersIdNr',
        },
        4
      ),
    ];

    it('fills the first shareholder NatPers from the user when it is a natürliche Person', async () => {
      const builder = new KapGXMLBuilder(serverConfig);

      const xml = await builder.buildXML(
        naturalPersonFirstShareholder(),
        [],
        user,
        1111,
        profileInfo
      );

      expect(xml).toMatch(
        /<NatPers>[\s\S]*<Vorname>Max<\/Vorname>[\s\S]*<\/NatPers>/
      );
      expect(xml).toMatch(
        /<NatPers>[\s\S]*<Name>Mustermann<\/Name>[\s\S]*<\/NatPers>/
      );
      expect(xml).toMatch(
        /<NatPers>[\s\S]*<GebDat>01\.01\.1990<\/GebDat>[\s\S]*<\/NatPers>/
      );
      expect(xml).toMatch(
        /<NatPers>[\s\S]*<AnredeId>1<\/AnredeId>[\s\S]*<\/NatPers>/
      );
      expect(xml).toMatch(
        /<NatPers>[\s\S]*<Adrkette><StrAdr><Str>Musterstraße<\/Str><HausNr>1<\/HausNr><Plz>10115<\/Plz><Ort>Berlin<\/Ort><\/StrAdr><\/Adrkette>[\s\S]*<\/NatPers>/
      );
      // NatPers children land in schema order (AnredeId, Vorname, Name, …).
      expect(xml).toMatch(
        /<NatPers><AnredeId>1<\/AnredeId><Vorname>Max<\/Vorname><Name>Mustermann<\/Name>/
      );
    });

    it('overwrites only the first shareholder, leaving additional shareholders untouched', async () => {
      const builder = new KapGXMLBuilder(serverConfig);

      const answers: Answers[] = [
        ...naturalPersonFirstShareholder(),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St81_1',
            value: '2',
            xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
          },
          5
        ),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St84a_1',
            value: '88',
            xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
          },
          6
        ),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St83b_1',
            value: 'Schmidt',
            xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Name',
          },
          7
        ),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St83d_1',
            value: 'Erika',
            xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Vorname',
          },
          8
        ),
      ];

      const xml = await builder.buildXML(answers, [], user, 1111, profileInfo);

      // The second shareholder keeps its own entered name, not the user's.
      expect(xml).toContain('<Name>Schmidt</Name>');
      expect(xml).toContain('<Vorname>Erika</Vorname>');
      expect(xml).toContain('<Name>Mustermann</Name>');
      expect(xml).toContain('<Vorname>Max</Vorname>');
    });

    it('does not inject user personal data when the first shareholder is a Firma', async () => {
      const builder = new KapGXMLBuilder(serverConfig);

      const answers: Answers[] = [
        makeAnswer(
          {
            componentId: 'St183',
            key: 'St183a',
            value: '30000',
            xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
          },
          1
        ),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St81_0',
            value: '1',
            xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
          },
          2
        ),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St84a_0',
            value: '12',
            xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
          },
          3
        ),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St82a_0',
            value: 'Acme GmbH',
            xmlKey: 'Gesellschafter/Anteilseigner/NNatPers/Firmenname',
          },
          4
        ),
        makeAnswer(
          {
            componentId: 'St81',
            key: 'St82b_0',
            value: 'Handel',
            xmlKey: 'Gesellschafter/Anteilseigner/NNatPers/ArtTaetigkeit',
          },
          5
        ),
      ];

      const xml = await builder.buildXML(answers, [], user, 1111, profileInfo);

      expect(xml).toContain('<NNatPers>');
      expect(xml).not.toContain('<NatPers>');
      // No applicant identity merged into the shareholder block.
      expect(xml).not.toMatch(
        /<Anteilseigner>[\s\S]*<Name>Mustermann<\/Name>[\s\S]*<\/Anteilseigner>/
      );
    });
  });
});
