import { Answers, ShUser } from '@startuphafen/startuphafen-common';
import { XMLBuilder } from 'fast-xml-parser';
import _ from 'lodash';
import { ServerConfig } from '../../config';
import {
  normalizeEszett,
  toGermanDate,
  XMLBuilderService,
} from './xml-builder-service';

export class EUnXMLBuilder {
  DATE_FIELDS = ['GebDat', 'Betriebsbeginn', 'UebertrStichtag'];

  ANREDE: Record<string, string> = { Herr: '1', Frau: '2' };

  ALLGANGABEN_CHILDREN: string[] = [
    'Inhaber',
    'Ehegatte',
    'Komm',
    'ArtTaet',
    'BankKonto',
    'Steuerberater',
    'Empfangsbev',
    'BisherigeVerhaeltnisse',
  ];

  SORTRULESET_ROOT: string[] = [
    'FragebogenTyp',
    'Ordnungskriterium',
    'AllgAngaben',
    'Betrieb',
    'FestsetzungsAngaben',
    'GewinnErmittlgsAngaben',
    'Freistellungsbescheinigung',
    'AngabenLohnsteuer',
    'Umsatzsteuer',
    'Nachreichung',
  ];

  SORTRULESET_ALLGANGABEN: string[] = [
    'Inhaber',
    'Ehegatte',
    'Komm',
    'ArtTaet',
    'BankKonto',
    'Steuerberater',
    'Empfangsbev',
    'BisherigeVerhaeltnisse',
  ];

  SORTRULESET_ENKAEUFE: string[] = ['GruendJahrA', 'FolgeJahrA'];

  SORTRULESET_UMSAETZE: string[] = ['GruendJahr', 'FolgeJahr'];

  SORTRULESET_PLZ: string[] = [
    'Str',
    'HausNr',
    'HausNrZu',
    'AdressErg',
    'Plz',
    'Ort',
  ];

  SORTRULESET_GRUENDUNGS_ART: string[] = [
    'GruendungsArt',
    'UebertrStichtag',
    'VorherigerInhaber',
    'VorherigesUnternehmen',
  ];

  SORTRULESET_UNTERNEHMEN: string[] = [
    'Unternehmen',
    'Geschaeftsleitung',
    'BetrBeginn',
    'Betriebsstaette',
    'HrgAngaben',
    'Gruendungsangaben',
    'BisherigeBetrieblicheVerhaeltnisse',
    'Konzern',
  ];

  SORTRULESET_ZAHLLAST_UEBERSCHUSS: string[] = [
    'Auswahl',
    'Betrag',
    'VoranmeldungMonatlich',
  ];

  SORTRULESET_UMZST: string[] = [
    'Geschaeftsveraeusserung',
    'BisherigeVerhaeltnisse',
    'GesUmsatz',
    'KleinunternehmerRegelung',
    'ZahllastUeberschuss',
    'Organschaft',
    'Steuerbefreiung',
    'ErmSteuersatz',
    'Durchschnittssatzbesteuerung',
    'SollIstVersteuerung',
    'UStIdNr',
    'SteuerschuldnerschaftLE',
    'Oss',
    'Onlinehandel',
  ];

  SORTRULESET_NATPERS: string[] = [
    'AnredeId',
    'Vorname',
    'Name',
    'Vorsatz',
    'Zusatz',
    'Titel',
    'GebName',
    'GebDat',
    'Berufsbez',
    'PersIdNr',
    'StNr',
    'Religion',
    'WIdNr',
    'Adrkette',
    'StandEhe',
  ];

  private xmlBuilderService: XMLBuilderService;
  constructor(private serverConfig: ServerConfig) {
    this.xmlBuilderService = new XMLBuilderService(
      (obj: any, ruleSets: Record<string, string[]>) =>
        this.findApplicableRuleSet(obj, ruleSets),
      (value, key) => this.sanitizeValues(value, key)
    );
  }

  async buildXML(content: Answers[], user: ShUser, bufaNr: number) {
    const xmlKeyAdjusted = this.normalizeLegacyAnswerKeys(content);
    const contentFilled = this.xmlBuilderService.fillStructure(xmlKeyAdjusted);
    const afterDefault = await this.fillDefaults(contentFilled, content, user);
    const afterChanges = this.logicAdj(afterDefault);

    const sorted = this.sortEUnObject(afterChanges);

    const builtEUn = new XMLBuilder().build({
      EUn: sorted,
    });

    const xmlFull = `<?xml version="1.0" encoding="UTF-8"?>
<Elster xmlns="http://www.elster.de/elsterxml/schema/v11">
    <TransferHeader version="11">
        <Verfahren>ElsterFSE</Verfahren>
        <DatenArt>EUn</DatenArt>
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
                <FsE_EUn xmlns="http://finkonsens.de/elster/elsterfse/eun/v202401" version="202401">
                ${builtEUn}
                </FsE_EUn>
            </Nutzdaten>
        </Nutzdatenblock>
    </DatenTeil>
</Elster>`;
    // {{HERSTELLER_ID}} is intentionally left in place here; it is substituted
    // by the external ERiC gateway this XML is posted to.
    return this.serverConfig.eric.devMode
      ? xmlFull
      : xmlFull.replace(/{{TESTMERKER}}/g, '');
  }

  private normalizeLegacyAnswerKeys(content: Answers[]) {
    return content.map((answer) => {
      const firstSegment = answer.xmlKey.split('/')[0];
      if (this.ALLGANGABEN_CHILDREN.includes(firstSegment)) {
        const newAnswer = structuredClone(answer);
        newAnswer.xmlKey = `AllgAngaben/${answer.xmlKey}`;
        return newAnswer;
      }
      return answer;
    });
  }
  private logicAdj(EUn: any) {
    try {
      const eun = EUn;
      if (eun.Betrieb.Unternehmen?.EntsprichtWohnanschrift === 'true') {
        delete eun.Betrieb.Unternehmen?.Adrkette;
      }
      return eun;
    } catch {
      return EUn;
    }
  }

  sortEUnObject(eunObj: any) {
    const ruleSets: Record<string, string[]> = {
      root: this.SORTRULESET_ROOT,
      allgAngaben: this.SORTRULESET_ALLGANGABEN,
      address: this.SORTRULESET_PLZ,
      unternehmen: this.SORTRULESET_UNTERNEHMEN,
      gruendungsArt: this.SORTRULESET_GRUENDUNGS_ART,
      zahllastUeberschuss: this.SORTRULESET_ZAHLLAST_UEBERSCHUSS,
      natPers: this.SORTRULESET_NATPERS,
      umsatzsteuer: this.SORTRULESET_UMZST,
      einkaeufe: this.SORTRULESET_ENKAEUFE,
      umsaetze: this.SORTRULESET_UMSAETZE,
    };

    return this.xmlBuilderService.sortObjectRecursively(eunObj, ruleSets);
  }

  async fillDefaults(objToFill: any, _answers: Answers[], user: ShUser) {
    _.merge(objToFill, {
      Ordnungskriterium: { OrdNrArt: 'O' },
    });

    _.merge(objToFill, {
      Umsatzsteuer: { UStIdNr: { UStIdAntrag: { MerkerAntragUStId: 'true' } } },
    });

    if (
      (objToFill.Umsatzsteuer.KleinunternehmerRegelung &&
        objToFill.Umsatzsteuer.KleinunternehmerRegelung.KleinUnternUSt ===
          'true') ||
      objToFill.Umsatzsteuer.KleinunternehmerRegelung == null
    ) {
      _.merge(objToFill, {
        Umsatzsteuer: { ZahllastUeberschuss: { Auswahl: '1' } },
      });
      _.merge(objToFill, {
        Umsatzsteuer: {
          ZahllastUeberschuss: { Betrag: 0 },
        },
      });
    }
    _.merge(objToFill, {
      FragebogenTyp: 'AUFNTAET',
    });

    _.merge(objToFill, {
      Betrieb: {
        Gruendungsangaben: {
          GruendungsForm: {
            GruendungsArt: 1,
          },
        },
      },
    });

    _.merge(objToFill, {
      AllgAngaben: {
        Inhaber: {
          NatPers: {
            Vorname: normalizeEszett(user.firstName),
            Name: normalizeEszett(user.lastName),
            GebDat: toGermanDate(user.dateOfBirth),
          },
        },
      },
    });

    if (user.title === 'Herr' || user.title === 'Frau') {
      _.merge(objToFill, {
        AllgAngaben: {
          Inhaber: {
            NatPers: {
              AnredeId: user.title === 'Herr' ? 1 : 2,
            },
          },
        },
      });
    }

    if (
      user.academicTitle != null &&
      user.academicTitle !== '' &&
      user.title !== 'Keine Angabe'
    ) {
      _.merge(objToFill, {
        AllgAngaben: {
          Inhaber: {
            NatPers: {
              Titel: normalizeEszett(user.academicTitle),
            },
          },
        },
      });
    }

    // Parse street address correctly with the updated function
    const { streetName, houseNumber, houseNumberSuffix } =
      this.xmlBuilderService.parseStreetAddress(user.street);

    const addressObject: any = {
      AllgAngaben: {
        Inhaber: {
          NatPers: {
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
      },
    };

    if (houseNumberSuffix) {
      addressObject.AllgAngaben.Inhaber.NatPers.Adrkette.StrAdr.HausNrZu =
        houseNumberSuffix;
    }

    _.merge(objToFill, addressObject);

    return objToFill;
  }

  private sanitizeValues(val: string, key: string) {
    const recMappings: Record<string, Record<string, string>> = {
      AnredeId: this.ANREDE,
      AuswahlSollIstVerst: {
        Sollversteuerung: '1',
        Istversteuerung: '2',
      },
    };

    let sanitized = normalizeEszett(val);

    if (this.DATE_FIELDS.includes(key)) sanitized = toGermanDate(sanitized);
    if (key === 'EntsprichtWohnanschrift') sanitized = 'true';

    const mapping = recMappings[key];
    if (mapping && Object.prototype.hasOwnProperty.call(mapping, val)) {
      sanitized = mapping[val];
    }

    return sanitized;
  }

  private findApplicableRuleSet(
    obj: any,
    ruleSets: Record<string, string[]>
  ): string[] {
    if ('FragebogenTyp' in obj) {
      return ruleSets['root'];
    }

    if ('Inhaber' in obj) {
      return ruleSets['allgAngaben'];
    }

    // Address handling
    if ('Str' in obj && 'Plz' in obj) {
      return ruleSets['address'];
    }

    if ('GesUmsatz' in obj) {
      return ruleSets['umsatzsteuer'];
    }

    // Unternehmen section
    if ('Unternehmen' in obj || 'BetrBeginn' in obj) {
      return ruleSets['unternehmen'];
    }

    // GruendungsForm section
    if ('GruendungsArt' in obj) {
      return ruleSets['gruendungsArt'];
    }

    // Voranmeldung section
    if (
      ('Betrag' in obj && 'Auswahl' in obj) ||
      'VoranmeldungMonatlich' in obj
    ) {
      return ruleSets['zahllastUeberschuss'];
    }

    if ('Vorname' in obj && 'Religion' in obj) {
      return ruleSets['natPers'];
    }

    // Check for income objects (EinkGewBetr or EinkSelbst) by their keys
    if ('GruendJahrA' in obj && 'FolgeJahrA' in obj) {
      return ruleSets['einkaeufe'];
    }

    if ('GruendJahr' in obj && 'FolgeJahr' in obj) {
      return ruleSets['umsaetze'];
    }

    // Default to an empty array if no rule set matches
    return [];
  }
}
