import { Answers, ShUser } from '@startuphafen/startuphafen-common';
import { ServerConfig } from '../../config';
import { EUnXMLBuilder } from './eun-xml-builder';

describe('EUnXMLBuilder', () => {
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
    xmlKey: 'EUn/Betrieb/ArtTaet',
    ...overrides,
  });

  const serverConfig = {
    eric: {
      devMode: false,
    },
  } as unknown as ServerConfig;

  const user: ShUser = {
    academicTitle: null,
    cellPhoneNumber: '',
    city: 'Berlin',
    country: 'DE',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    dateOfBirth: '1990-05-04',
    email: 'user@example.com',
    firstName: 'Max',
    inboxReference: '',
    id: 'user-1',
    lastName: 'Mustermann',
    name: null,
    phoneNumber: '123456',
    postalCode: '10115',
    roles: null,
    street: 'Beispielweg 12a',
    title: 'Herr',
  };

  it('builds XML with user defaults and checkbox text', async () => {
    const builder = new EUnXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St25',
          key: 'St25',
          value: 'Ich starte ein Gewerbe.',
          xmlKey: 'EUn/Betrieb/Beschreibung',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St25a',
          key: 'St25a',
          value: 'true',
          xmlKey: 'EUn/Betrieb/Checkbox',
        },
        2
      ),
    ];

    const xml = await builder.buildXML(answers, user, 1111);

    expect(xml).not.toContain('{{TESTMERKER}}');
    expect(xml).toContain('<FragebogenTyp>AUFNTAET</FragebogenTyp>');
    expect(xml).toContain('<HausNr>12</HausNr>');
    expect(xml).toContain('<HausNrZu>a</HausNrZu>');
    expect(xml).toContain('<AnredeId>1</AnredeId>');
    expect(xml).toContain('eun/v202401" version="202401"');
    expect(xml).toMatch(/<AllgAngaben>[\s\S]*<Inhaber>[\s\S]*<\/AllgAngaben>/);
    expect(xml).toContain('<GebDat>04.05.1990</GebDat>');
  });

  it('serializes final 202401 EUn keys without legacy remapping', async () => {
    const builder = new EUnXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St11',
          key: 'St11',
          value: 'st11Ans-1',
          stringValue: '11',
          xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St25',
          key: 'St25',
          value: 'Softwareentwicklung',
          xmlKey: 'AllgAngaben/ArtTaet/GewerbeArt',
        },
        2
      ),
    ];

    const xml = await builder.buildXML(answers, user, 1111);

    expect(xml).toContain('<Religion>11</Religion>');
    expect(xml).toContain('<GewerbeArt>Softwareentwicklung</GewerbeArt>');
  });

  it('normalizes legacy EUn AllgAngaben keys for existing applications', async () => {
    const builder = new EUnXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St11',
          key: 'St11',
          value: 'st11Ans-1',
          stringValue: '11',
          xmlKey: 'Inhaber/NatPers/Religion',
        },
        1
      ),
      makeAnswer(
        {
          componentId: 'St25',
          key: 'St25',
          value: 'Softwareentwicklung',
          xmlKey: 'ArtTaet/GewerbeArt',
        },
        2
      ),
    ];

    const xml = await builder.buildXML(answers, user, 1111);

    expect(xml).toContain('<Religion>11</Religion>');
    expect(xml).toMatch(
      /<AllgAngaben>[\s\S]*<ArtTaet>[\s\S]*<GewerbeArt>Softwareentwicklung<\/GewerbeArt>/
    );
  });

  it('normalizes old soll/ist values for Umsatzsteuer serialization', async () => {
    const builder = new EUnXMLBuilder(serverConfig);

    const answers: Answers[] = [
      makeAnswer(
        {
          componentId: 'St149',
          key: 'St149',
          value: 'st149Ans-1',
          stringValue: 'Sollversteuerung',
          xmlKey: 'Umsatzsteuer/SollIstVersteuerung/AuswahlSollIstVerst',
        },
        1
      ),
    ];

    const xml = await builder.buildXML(answers, user, 1111);

    expect(xml).toContain('<AuswahlSollIstVerst>1</AuswahlSollIstVerst>');
    expect(xml).not.toContain(
      '<AuswahlSollIstVerst>Sollversteuerung</AuswahlSollIstVerst>'
    );
  });
});
