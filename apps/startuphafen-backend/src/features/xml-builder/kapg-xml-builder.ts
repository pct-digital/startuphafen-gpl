import { bytesToBase64 } from '@startuphafen/base64';
import {
  Answers,
  ShUser,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { XMLBuilder } from 'fast-xml-parser';
import _ from 'lodash';
import { ServerConfig } from '../../config';
import { ProfileInfoResult } from '../profile-info/profile-info-db-controller';
import {
  normalizeEszett,
  toGermanDate,
  XMLBuilderService,
} from './xml-builder-service';

export class KapGXMLBuilder {
  private xmlBuilderService: XMLBuilderService;

  DATE_FIELDS = [
    'GebDat',
    'Betriebsbeginn',
    'NotarVertrag',
    'BeginnLohnzahlungen',
    'DatumGVertrag',
    'TagDesAntrags',
    'TagDerEintragung',
    'AbwWJ_ab',
  ];

  SORTRULESET_ROOT: string[] = [
    'FragebogenTyp',
    'Ordnungskriterium',
    'AllgAngaben',
    'Gesellschafter',
    'Gruendung',
    'BetriebAufspaltung',
    'ZusAngaben',
    'FestsetzungsAngaben',
    'LohnberechnungsStelle',
    'Umsatzsteuer',
    'Freistellungsbescheinigung',
    'Nachreichung',
    'EOP',
  ];

  SORTRULESET_TEL: string[] = ['IntVorw', 'NatVorw', 'RufNr'];

  SORTRULESET_NATPERS: string[] = [
    'AnredeId',
    'Vorname',
    'Name',
    'Vorsatz',
    'Zusatz',
    'Titel',
    'GebDat',
    'PersIdNr',
    'StNr',
    'Berufsbez',
    'Adrkette',
    'Komm',
    'Ordnungskriterium',
  ];

  SORTRULESET_ALLG_ANGABEN: string[] = [
    'Firmenname',
    'SitzKapGes',
    'Adrkette',
    'Geschaeftsleitung',
    'Komm',
    'ArtTaet',
    'Betriebsstaette',
    'Vertreter',
    'Steuerberater',
    'Empfangsbev',
    'BankKonto',
    'NotarVertrag',
    'Rechtsform',
    'BeginnTaetigkeit',
    'GewinnErmittlgsAngaben',
    'HoeheGrundStammkapital',
  ];

  SORTRULESET_LOHN: string[] = [
    'AnzahlBeschaeftigteArbeitnehmer',
    'AnzahlGesellschafterBeschaeftigte',
    'AnzahlGeringfuegigBeschaeftigte',
    'BeginnLohnzahlungen',
    'VoraussichtlicheLohnsteuer',
    'BetriebLohnAbr',
    'Adrkette',
  ];

  SORTRULESET_UMSATZSTEUER: string[] = [
    'Geschaeftsveraeusserung',
    'GesUmsatz',
    'KleinunternehmerRegelung',
    'ZahllastUeberschuss',
    'Steuerbefreiung',
    'ErmSteuersatz',
    'Durchschnittssatzbesteuerung',
    'SollIstVersteuerung',
    'UStIdNr',
    'SteuerschuldnerschaftLE',
    'Oss',
    'Onlinehandel',
  ];

  SORTRULESET_BETEILIGUNG: string[] = ['Nominal', 'ProzentAnteil'];

  SORTRULESET_ANTEILSEIGNER: string[] = [
    'ZeichnerNummer',
    'NatPers',
    'NNatPers',
    'Beteiligung',
  ];

  SORTRULESET_NNAT_PERS: string[] = [
    'AnredeId',
    'Firmenname',
    'ArtTaetigkeit',
    'Adrkette',
    'Ordnungskriterium',
  ];

  SORTRULESET_NOTAR: string[] = [
    'DatumGVertrag',
    'HrgAngaben',
    'GruendungsNotar',
  ];

  SORTRULESET_JAHRWERTE: string[] = ['GruendJahr', 'FolgeJahr'];

  SORTRULESET_POSTFACH: string[] = ['Postfach', 'Plz', 'Ort'];

  SORTRULESET_ADRESSE: string[] = [
    'Str',
    'HausNr',
    'HausNrZu',
    'AdressErg',
    'Plz',
    'Ort',
  ];

  SORTRULESET_KAPITAL: string[] = ['Grundstammkapital', 'Eingezahlteskapital'];

  SORTRULESET_HRG: string[] = [
    'HrgAntragGestellt',
    'TagDesAntrags',
    'HrgEintragVorhanden',
    'TagDerEintragung',
    'HandelsregisterGericht',
    'HrgRegisterbezeichnung',
    'HrgRegisternummer',
  ];
  SORTRULESET_ABS: string[] = ['Abs2', 'Abs3'];

  SORTRULESET_BAU: string[] = [
    'NachweisBeantragt',
    'UmfangBauleistungen',
    'UmfangGebaeudereinigung',
  ];
  SORTRULESET_FESTSETZ: string[] = [
    'Gewinn',
    'ZuVerstEink',
    'StAnrBetr',
    'Gewerbeertrag',
  ];

  SORTRULESET_ZAHLLAST_UEBERSCHUSS: string[] = [
    'Auswahl',
    'Betrag',
    'VoranmeldungMonatlich',
  ];

  SORTRULESET_STEUERSATZ: string[] = [
    'MerkerSteuerbefreiung',
    'MerkerSteuersatz',
    'MerkerDurchschnittssatzbesteuerung',
    'UStGNr',
    'UStGNr1',
    'UStGNr2',
    'UStGNr3',
    'UStGNr4',
    'UmsatzArt',
  ];

  constructor(private serverConfig: ServerConfig) {
    this.xmlBuilderService = new XMLBuilderService(
      (obj: any, ruleSets: Record<string, string[]>) =>
        this.findApplicableRuleSet(obj, ruleSets),
      (value, key) => this.sanitizeValues(value, key)
    );
  }

  findApplicableRuleSet(obj: any, ruleSets: Record<string, string[]>) {
    if ('FragebogenTyp' in obj) {
      return ruleSets['root'];
    }
    if ('RufNr' in obj) {
      return ruleSets['tel'];
    }
    if (('Vorname' in obj && 'Name' in obj) || 'PersIdNr' in obj) {
      return ruleSets['natpers'];
    }
    if ('Firmenname' in obj && 'Vertreter' in obj) {
      return ruleSets['allgang'];
    }
    if ('BeginnLohnzahlungen' in obj) {
      return ruleSets['lohn'];
    }
    if ('GesUmsatz' in obj) {
      return ruleSets['umsatzsteuer'];
    }
    if ('Nominal' in obj) {
      return ruleSets['beteiligung'];
    }
    if ('ZeichnerNummer' in obj) {
      return ruleSets['anteilseigner'];
    }
    if ('ArtTaetigkeit' in obj) {
      return ruleSets['nnat_pers'];
    }
    if ('Postfach' in obj) {
      return ruleSets['postfach'];
    }
    if ('GruendungsNotar' in obj) {
      return ruleSets['notar'];
    }
    if ('GruendJahr' in obj) {
      return ruleSets['jahrwerte'];
    }
    if (
      'Str' in obj &&
      ('HausNr' in obj || 'HausNrZu' in obj || 'Plz' in obj)
    ) {
      return ruleSets['adresse'];
    }
    if ('Grundstammkapital' in obj && 'Eingezahlteskapital' in obj) {
      return ruleSets['kapital'];
    }
    if ('HrgAntragGestellt' in obj) {
      return ruleSets['hrg'];
    }
    if ('Grundstammkapital' in obj) {
      return ruleSets['kapital'];
    }
    if ('Abs2' in obj || 'Abs3' in obj) {
      return ruleSets['abs'];
    }
    if ('NachweisBeantragt' in obj) {
      return ruleSets['bau'];
    }
    if ('ZuVerstEink' in obj) {
      return ruleSets['festsetz'];
    }
    if (
      ('Betrag' in obj && 'Auswahl' in obj) ||
      'VoranmeldungMonatlich' in obj
    ) {
      return ruleSets['zahllastUeberschuss'];
    }
    if ('UmsatzArt' in obj) {
      return ruleSets['steuersatz'];
    }
    return [];
  }

  private logicAdj(obj: any) {
    if (obj['Gesellschafter']['Anteilseigner'].length === 0)
      throw new Error('Faulty Answers: No Anteilseigner present.');
    for (const anteilseigner of obj['Gesellschafter']['Anteilseigner']) {
      anteilseigner['Beteiligung']['Nominal'] =
        anteilseigner['Beteiligung']['Nominal'] + '.00';
    }
    return obj;
  }

  sortKapGObject(obj: any) {
    const ruleSets: Record<string, string[]> = {
      root: this.SORTRULESET_ROOT,
      tel: this.SORTRULESET_TEL,
      natpers: this.SORTRULESET_NATPERS,
      allgang: this.SORTRULESET_ALLG_ANGABEN,
      lohn: this.SORTRULESET_LOHN,
      umsatzsteuer: this.SORTRULESET_UMSATZSTEUER,
      beteiligung: this.SORTRULESET_BETEILIGUNG,
      anteilseigner: this.SORTRULESET_ANTEILSEIGNER,
      nnat_pers: this.SORTRULESET_NNAT_PERS,
      postfach: this.SORTRULESET_POSTFACH,
      notar: this.SORTRULESET_NOTAR,
      jahrwerte: this.SORTRULESET_JAHRWERTE,
      adresse: this.SORTRULESET_ADRESSE,
      hrg: this.SORTRULESET_HRG,
      kapital: this.SORTRULESET_KAPITAL,
      abs: this.SORTRULESET_ABS,
      bau: this.SORTRULESET_BAU,
      festsetz: this.SORTRULESET_FESTSETZ,
      zahllastUeberschuss: this.SORTRULESET_ZAHLLAST_UEBERSCHUSS,
      steuersatz: this.SORTRULESET_STEUERSATZ,
    };
    return this.xmlBuilderService.sortObjectRecursively(obj, ruleSets);
  }

  sanitizeValues(value: string, key: string) {
    let sVal = normalizeEszett(value);

    if (this.DATE_FIELDS.includes(key)) sVal = toGermanDate(sVal);

    return sVal;
  }

  private normalizeLegacyAnswerKeys(content: Answers[]) {
    const exact: Record<string, string> = {
      'Umsatzsteuer/Steuerbefreiung/Merker':
        'Umsatzsteuer/Steuerbefreiung/MerkerSteuerbefreiung',
      'Umsatzsteuer/ErmSteuersatz/Abs1/Merker':
        'Umsatzsteuer/ErmSteuersatz/Abs2/MerkerSteuersatz',
      'Umsatzsteuer/Durchschnittbesteuerung/Merker':
        'Umsatzsteuer/Durchschnittssatzbesteuerung/MerkerDurchschnittssatzbesteuerung',
      'AllgAngaben/Vertreter/Ordnungskriterium/PersIdNr':
        'AllgAngaben/Vertreter/PersIdNr',
      'AllgAngaben/Vertreter/Ordnungskriterium/StNr':
        'AllgAngaben/Vertreter/StNr',
      'Gesellschafter/Anteilseigner/NatPers/Ordnungskriterium/PersIdNr':
        'Gesellschafter/Anteilseigner/NatPers/PersIdNr',
    };
    const prefixes: [string, string][] = [
      ['Umsatzsteuer/ErmSteuersatz/Abs1/', 'Umsatzsteuer/ErmSteuersatz/Abs2/'],
      [
        'Umsatzsteuer/Durchschnittbesteuerung/',
        'Umsatzsteuer/Durchschnittssatzbesteuerung/',
      ],
    ];

    return content.map((answer) => {
      const oldKey = answer.xmlKey;
      if (oldKey == null) return answer;
      let newKey = exact[oldKey];
      if (newKey == null) {
        const match = prefixes.find(([from]) => oldKey.startsWith(from));
        newKey = match ? match[1] + oldKey.slice(match[0].length) : oldKey;
      }
      const newStringValue = this.normalizeAnswerStringValue(
        answer.stringValue,
        newKey
      );
      const newValue = this.normalizeAnswerValue(answer.value, newKey);
      if (
        newKey === oldKey &&
        newStringValue === answer.stringValue &&
        newValue === answer.value
      )
        return answer;
      const newAnswer = structuredClone(answer);
      newAnswer.xmlKey = newKey;
      newAnswer.stringValue = newStringValue;
      newAnswer.value = newValue;
      return newAnswer;
    });
  }

  private normalizeAnswerStringValue(value: string | null, xmlKey: string) {
    if (value == null) return value;
    return this.normalizeAnswerValue(value, xmlKey);
  }

  private normalizeAnswerValue(value: string, xmlKey: string) {
    if (xmlKey !== 'Umsatzsteuer/SollIstVersteuerung/AuswahlSollIstVerst')
      return value;
    if (value === 'Sollversteuerung') return '1';
    if (value === 'Istversteuerung') return '2';
    return value;
  }

  async buildXML(
    content: Answers[],
    attachments: UserDocument[],
    user: ShUser,
    bufaNr: number,
    profileInfo: ProfileInfoResult
  ) {
    const xmlKeyAdjusted = this.normalizeLegacyAnswerKeys(content);
    const fill = this.xmlBuilderService.fillStructure(xmlKeyAdjusted, ['St81']);

    const anteilseigner = this.buildAnteilseigner(xmlKeyAdjusted, user);
    _.merge(fill, anteilseigner);

    const defaults = this.fillDefaults(fill, user, profileInfo);

    const sorted = this.sortKapGObject(defaults);

    const logicAdjusted = this.logicAdj(sorted);

    const attachements = this.addAttachements(attachments, user);
    const attachXml = new XMLBuilder({
      attributeNamePrefix: '@',
      ignoreAttributes: false,
    }).build({ Anhaenge: attachements['Anhaenge'] });

    const answerXml = new XMLBuilder({
      attributeNamePrefix: '@',
      ignoreAttributes: false,
    }).build({ KapG: logicAdjusted });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Elster xmlns="http://www.elster.de/elsterxml/schema/v11">
    <TransferHeader version="11">
        <Verfahren>ElsterFSE</Verfahren>
        <DatenArt>KapG</DatenArt>
        <Vorgang>send-Auth</Vorgang>
        {{TESTMERKER}}
        <HerstellerID>{{HERSTELLER_ID}}</HerstellerID>
        <DatenLieferant>startuphafen.sh</DatenLieferant>
        <Datei>
            <Verschluesselung>CMSEncryptedData</Verschluesselung>
            <Kompression>GZIP</Kompression>
            <TransportSchluessel/>
            <Erstellung/>
        </Datei>
    </TransferHeader>
    <DatenTeil>
        <Nutzdatenblock>
            <NutzdatenHeader version="11">
                <NutzdatenTicket>11</NutzdatenTicket>
                <Empfaenger id="F">${bufaNr}</Empfaenger>
            </NutzdatenHeader>
            <Nutzdaten>
                <FsE_KapG xmlns="http://finkonsens.de/elster/elsterfse/kapg/v202401" version="202401">
                    ${answerXml}
                </FsE_KapG>
                ${attachXml}
            </Nutzdaten>
        </Nutzdatenblock>
    </DatenTeil>
</Elster>
`;

    // {{HERSTELLER_ID}} is intentionally left in place here; it is substituted
    // by the external ERiC gateway this XML is posted to.
    return this.serverConfig.eric.devMode
      ? xml
      : xml.replace(/{{TESTMERKER}}/g, '');
  }

  fillDefaults(obj: any, user: ShUser, profileInfo: ProfileInfoResult) {
    _.merge(obj, { FragebogenTyp: 'GRNDKPG' });
    _.merge(obj, { Ordnungskriterium: { OrdNrArt: 'O' } });

    this.ensureKleinunternehmerRegelung(obj);

    if (
      (obj.Umsatzsteuer.KleinunternehmerRegelung &&
        obj.Umsatzsteuer.KleinunternehmerRegelung.KleinUnternUSt === 'true') ||
      obj.Umsatzsteuer.KleinunternehmerRegelung == null
    ) {
      _.merge(obj, {
        Umsatzsteuer: { ZahllastUeberschuss: { Auswahl: '1' } },
      });
      _.merge(obj, {
        Umsatzsteuer: {
          ZahllastUeberschuss: { Betrag: 0 },
        },
      });
    }

    _.merge(obj, {
      Gesellschafter: { Treuhandverhaeltnisse: { Treuhand: false } },
    });

    _.merge(obj, {
      AllgAngaben: {
        NotarVertrag: {
          HrgAngaben: {
            HrgAntragGestellt: true,
            HrgEintragVorhanden: true,
            HrgRegisterbezeichnung: 'HRB',
          },
        },
      },
    });

    const vertreterTel: Record<string, string> = {};
    if (profileInfo.phoneNational)
      vertreterTel['NatVorw'] = profileInfo.phoneNational;
    if (profileInfo.phoneNumber)
      vertreterTel['RufNr'] = profileInfo.phoneNumber;
    if (Object.keys(vertreterTel).length > 0) {
      _.merge(obj, {
        AllgAngaben: { Vertreter: { Komm: { Tel: vertreterTel } } },
      });
    }
    this.sanitizeKommTel(obj.AllgAngaben);
    this.sanitizeKommTel(obj.AllgAngaben?.Vertreter);

    _.merge(obj, {
      Umsatzsteuer: { UStIdNr: { MerkerAntragUStId: 'true' } },
    });

    _.merge(obj, {
      Gruendung: { AuswahlBarSach: '1' },
    });

    _.merge(obj, {
      AllgAngaben: {
        Vertreter: {
          Vorname: normalizeEszett(user.firstName),
          Name: normalizeEszett(user.lastName),
          GebDat: toGermanDate(user.dateOfBirth),
        },
      },
    });

    if (user.title === 'Herr' || user.title === 'Frau') {
      _.merge(obj, {
        AllgAngaben: {
          Vertreter: {
            AnredeId: user.title === 'Herr' ? 1 : 2,
          },
        },
      });
    }

    if (
      user.academicTitle != null &&
      user.academicTitle !== '' &&
      user.title !== 'Keine Angabe'
    ) {
      _.merge(obj, {
        AllgAngaben: {
          Vertreter: {
            Titel: normalizeEszett(user.academicTitle),
          },
        },
      });
    }

    // Parse street address correctly with the updated function
    const { streetName, houseNumber, houseNumberSuffix } =
      this.xmlBuilderService.parseStreetAddress(user.street);

    const addressObject: any = {
      AllgAngaben: {
        Vertreter: {
          Adrkette: {
            StrAdr: {
              Ort: normalizeEszett(user.city),
              Plz: user.postalCode,
              Str: normalizeEszett(streetName),
              HausNr: houseNumber,
            },
          },
        },
      },
    };

    if (houseNumberSuffix) {
      addressObject.AllgAngaben.Vertreter.Adrkette.StrAdr.HausNrZu =
        houseNumberSuffix;
    }

    _.merge(obj, addressObject);

    return obj;
  }

  // The first shareholder's personal data (Name, Vorname, Geburtsdatum,
  // Geschlecht, Adresse) was removed from the frontend form because it is the
  // applicant themselves. Source it from the authenticated user (BundID)
  // instead. Only applies when the first shareholder is a natürliche Person
  // (Firmen carry an NNatPers branch and are left untouched). Mutates the
  // shareholder's NatPers in place before it is sorted into schema order.
  private fillFirstShareholderPersonalData(natPers: any, user: ShUser) {
    natPers.Vorname = normalizeEszett(user.firstName);
    natPers.Name = normalizeEszett(user.lastName);
    natPers.GebDat = toGermanDate(user.dateOfBirth);

    if (user.title === 'Herr' || user.title === 'Frau') {
      natPers.AnredeId = user.title === 'Herr' ? 1 : 2;
    }

    const { streetName, houseNumber, houseNumberSuffix } =
      this.xmlBuilderService.parseStreetAddress(user.street);

    const strAdr: any = {
      Ort: normalizeEszett(user.city),
      Plz: user.postalCode,
      Str: normalizeEszett(streetName),
      HausNr: houseNumber,
    };
    if (houseNumberSuffix) {
      strAdr.HausNrZu = houseNumberSuffix;
    }

    natPers.Adrkette = { StrAdr: strAdr };
  }

  private sanitizeKommTel(container: any) {
    const tel = container?.Komm?.Tel;
    if (tel == null) return;
    if (tel.NatVorw && tel.RufNr) {
      if (!tel.IntVorw) tel.IntVorw = '+49';
      return;
    }
    delete container.Komm.Tel;
    if (Object.keys(container.Komm).length === 0) delete container.Komm;
  }

  private ensureKleinunternehmerRegelung(obj: any) {
    const regelung = obj.Umsatzsteuer?.KleinunternehmerRegelung;
    const hasKleinUnternUSt = regelung?.KleinUnternUSt != null;
    const hasKleinUnternUStVerzicht = regelung?.KleinUnternUStVerzicht != null;

    if (hasKleinUnternUSt && hasKleinUnternUStVerzicht) {
      throw new Error(
        'Faulty Answers: KleinUnternUSt and KleinUnternUStVerzicht must not both be present.'
      );
    }

    if (hasKleinUnternUSt || hasKleinUnternUStVerzicht) return;

    const gruendJahr = Number(obj.Umsatzsteuer?.GesUmsatz?.GruendJahr);
    if (!Number.isFinite(gruendJahr)) {
      throw new Error(
        'Faulty Answers: Umsatzsteuer/GesUmsatz/GruendJahr is required to determine KleinunternehmerRegelung.'
      );
    }

    if (gruendJahr > 25000) {
      _.merge(obj, {
        Umsatzsteuer: {
          KleinunternehmerRegelung: { KleinUnternUStVerzicht: 'true' },
        },
      });
      return;
    }

    throw new Error(
      'Faulty Answers: KleinUnternUSt or KleinUnternUStVerzicht must be present when GruendJahr is 25000 or less.'
    );
  }

  buildAnteilseigner(answers: Answers[], user: ShUser) {
    const st81 = answers.filter((e) => e.componentId === 'St81');
    const finalObjects: { Gesellschafter: { Anteilseigner: any[] } } = {
      Gesellschafter: { Anteilseigner: [] },
    };
    const seperated: string[][] = [];
    for (const answer of st81) {
      const split = answer.key.split('_');
      if (seperated[Number(split[1])] == null) seperated[Number(split[1])] = [];
      seperated[Number(split[1])].push(split[0] + '_' + split[1]);
    }

    for (const [index, anteilseigner] of seperated.entries()) {
      // `seperated` is indexed by shareholder number and may be sparse; skip
      // holes to match the previous forEach behavior.
      if (anteilseigner == null) continue;

      const filteredAnswers = answers.filter((e) =>
        anteilseigner.includes(e.key)
      );
      const anteilseignerObject: any =
        this.xmlBuilderService.fillStructure(filteredAnswers);

      // The first shareholder is the applicant; fill its personal data from
      // the user before sorting so the merged fields land in schema order.
      // Only natürliche Personen carry a NatPers branch (Firmen use NNatPers).
      const natPers =
        anteilseignerObject?.Gesellschafter?.Anteilseigner?.NatPers;
      if (index === 0 && natPers != null) {
        this.fillFirstShareholderPersonalData(natPers, user);
      }

      const sorted = this.sortKapGObject(anteilseignerObject);
      finalObjects.Gesellschafter.Anteilseigner.push(
        sorted['Gesellschafter']['Anteilseigner']
      );
    }
    return finalObjects;
  }

  private addAttachements(attachments: UserDocument[], user: ShUser) {
    const mergeObj: any = {
      Anhaenge: {
        '@version': '3',
        '@xmlns': 'http://finkonsens.de/elster/anhaenge/simple/v3',
        Rueckmeldung: {
          RueckmeldungGewuenscht: 'true',
          EmailRueckmeldung: user.email,
        },
        Anhang: [],
      },
    };
    for (const a of attachments) {
      mergeObj.Anhaenge.Anhang.push({
        Dateibezeichnung: a.filename.replaceAll('.pdf', ''),
        Dateityp: a.mimeType,
        Dateiinhalt: bytesToBase64(a.data),
      });
    }

    return mergeObj;
  }
}
