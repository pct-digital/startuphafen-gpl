import {
  ShAnswers,
  ShUser,
  XMLBuilderInterface,
} from '@startuphafen/startuphafen-common';
import { XMLBuilder } from 'fast-xml-parser';
import _ from 'lodash';
import { LocalSecrets, ServerConfig } from '../../config';

/**
 * Parses a street address string into street name and house number
 * @param street Full street address
 * @returns Object containing streetName and houseNumber details
 */
export function parseStreetAddress(street: string): {
  streetName: string;
  houseNumber: string;
  hasNonNumericPart: boolean;
} {
  // Match house number patterns including ranges (e.g., 21-30, 2a-2f)
  const match = street.match(/\s+(\d+\w*(?:-\d+\w*)?)\s*$/);

  if (match) {
    const houseNumber = match[1];
    // Remove the house number part from the street string and trim
    const streetName = street.substring(0, street.lastIndexOf(match[0])).trim();

    // Check if house number has any non-numeric characters
    const hasNonNumericPart = /[^\d]/.test(houseNumber);

    return {
      streetName,
      houseNumber,
      hasNonNumericPart,
    };
  }

  // Fallback if no house number is found
  return {
    streetName: street,
    houseNumber: '',
    hasNonNumericPart: false,
  };
}

export interface EUn {
  FragebogenTyp: 'AUFNTAET';
  Ordnungskriterium: { OrdNrArt: 'O' | 'S' };
  Inhaber: {
    NatPers: {
      AnredeId: 1 | 2;
      Vorname: string;
      Name: string;
      Titel?: string;
      GebDat: string;
      //will create a mapper as soon as I know how and/or if the religion values come from BundID
      Religion:
        | '11'
        | '03'
        | '02'
        | '05'
        | '20'
        | '21'
        | '07'
        | '16'
        | '13'
        | '14'
        | '15'
        | '17'
        | '25'
        | '19'
        | '26'
        | '18'
        | '27'
        | '28'
        | '12'
        | '29'
        | '24'
        | '04'
        | '10';
      Adrkette: {
        StrAdr: {
          Str: string;
          HausNr: string;
          HausNrZu?: string;
          AdressErg?: string;
          Plz: string;
          Ort: string;
        };
      };
      SteuerIDs?: { PersIdNr: string; StNr: string };
    };
  };
  ArtTaet: { GewerbeArt: string };
  Betrieb: {
    Unternehmen?: {
      AbwFirmenname?: string;
      EntsprichtWohnanschrift?: 'true';
      Adrkette?: {
        StrAdr: {
          Str: string;
          HausNr: string;
          HausNrZu?: string;
          AdressErg?: string;
          Plz: number;
          Ort: string;
        };
      };
    };
    BetrBeginn?: { Betriebsbeginn: string };
    Gruendungsangaben?: {
      //Immer 1 für Neugründung datum darf nicht in der zukunt liegen!!
      GruendungsForm: { GruendungsArt: 1 | 2 | 3 | 4; UebertrStichtag: string };
    };
  };
  FestsetzungsAngaben: {
    VoraussichtlicheEinkuenfte: {
      EinkGewBetr: { GruendJahrA: number; FolgeJahrA: number };
      EinkSelbst: { GruendJahrA: number; FolgeJahrA: number };
    };
  };
  GewinnErmittlgsAngaben: { GewinnErmittlung: '01' | '02' | '03' | '04' };
  Freistellungsbescheinigung: { AntragFreistBauabzugsSt: 'true' };
  //^(?=.{1,12}$)(?!0\d)\d{1,12}$ für GesUmsatz
  //IMPORTANT
  Umsatzsteuer: {
    GesUmsatz: { GruendJahr: number; FolgeJahr: number };
    SollIstVersteuerung: {
      AuswahlSollIstVerst: 'Sollversteuerung' | 'Istversteuerung';
      IstVerstUStGrundUmsatz?: 'true';
      IstVerstUStGrundAO?: 'true';
      IstVerstUStGrundFreierBeruf?: 'true';
    };
    UStIdNr: { UStIdAntrag: { MerkerAntragUStId: 'true' } };
    SteuerschuldnerschaftLE?: {
      NachweisBeantragt?: 'true';
      UmfangBauleistungen?: 'true';
      UmfangGebaeudereinigung?: 'true';
    };
    KleinunternehmerRegelung: {
      KleinUnternUSt: 'true';
      KleinUnternUStVerzicht: 'true';
    };
    ZahllastUeberschuss: {
      Auswahl: '1' | '2';
      Betrag?: number;
      VoranmeldungMonatlich?: 'true';
    };
  };
}

const DATE_FIELDS = ['GebDat', 'Betriebsbeginn', 'UebertrStichtag'];
const GEWINNERMITTLUNG: Record<string, string> = {
  Einnahmeüberschussrechnung: '01',
  Betriebsvermögensausgleich: '02',
};
//IMPORTANT: klären welches Feld in der UI das hier wiederspiegelt
const ORDNRART: Record<string, string> = { Art1: 'O', Art2: 'S' };
const RELIGION: Record<string, string> = {
  'Nicht Kirchensteuerpflichtig': '11',
  'Römisch-katholisch': '03',
  Evangelisch: '02',
  'Evangelisch-reformiert': '05',
  'Evangelisch-reformierte Kirche Bückeburg': '20',
  'Evangelisch-reformierte Kirche Stadthagen': '21',
  'Französisch-reformiert': '07',
  'Freie Religionsgemeinschaft Alzey': '16',
  'Freireligiöse Landesgemeinde Baden': '13',
  'Freireligiöse Landesgemeinde Pfalz': '14',
  'Freireligiöse Gemeinde Mainz': '15',
  'Freireligiöse Gemeinde Offenbach': '17',
  'Israelitische Religionsgemeinschaft Baden': '25',
  'Jüdische Gemeinden im Landesverband Hessen': '19',
  'Landesverband der israelitischen Kultusgemeinden in Bayern': '26',
  'Jüdische Gemeinde Frankfurt (Hessen)': '18',
  'Jüdische Kultusgemeinden Bad Kreuznach und Koblenz': '27',
  'Israelitisch (Saarland)': '28',
  'Israelitische Religionsgemeinschaft Württemberg': '12',
  'Nordrhein-Westfalen: Israelitisch (jüdisch)': '29',
  'Jüdische Gemeinde Hamburg': '24',
  Altkatholisch: '04',
  Sonstige: '10',
};
const GRUENDART: Record<string, string> = {
  Neugründung: '1',
  Art2: '2',
  Art3: '3',
  Art4: '4',
};
//Divers oder andere Möglichkeiten gibt es nicht?
const ANREDE: Record<string, string> = { Herr: '1', Frau: '2' };

const KLUNTREGELUNG: Record<string, string> = {
  'Kleinunternehmerregelung annehmen': 'true',
  'Kleinunternehmerregelung ablehnen': 'true',
};

const ZLLÜBER: Record<string, string> = {
  Zahllast: '1',
  Überschuss: '2',
};

const VORANMELDUNG: Record<string, string> = {
  'Monatliche Voranmeldung annehmen': 'true',
  'Monatliche Voranmeldung ablehnen': 'true',
};

const SORTRULESET_ROOT: string[] = [
  'FragebogenTyp',
  'Ordnungskriterium',
  'Inhaber',
  'ArtTaet',
  'Betrieb',
  'FestsetzungsAngaben',
  'GewinnErmittlgsAngaben',
  'Freistellungsbescheinigung',
  'Umsatzsteuer',
];

const SORTRULESET_PLZ: string[] = [
  'Str',
  'HausNr',
  'HausNrZu',
  'AdressErg',
  'Plz',
  'Ort',
];

const SORTRULESET_GRUENDUNGS_ART: string[] = [
  'GruendungsArt',
  'UebertrStichtag',
  'VorherigerInhaber',
  'VorherigesUnternehmen',
];

const SORTRULESET_UNTERNEHMEN: string[] = [
  'Unternehmen',
  'Geschaeftsleitung',
  'BetrBeginn',
  'BetriebsstaettenListe',
  'HrgAngaben',
  'Gruendungsangaben',
  'BisherigeBetrieblicheVerhaeltnisse',
  'Konzern',
];

const SORTRULESET_ZAHLLAST_UEBERSCHUSS: string[] = [
  'Auswahl',
  'Betrag',
  'VoranmeldungMonatlich',
];

const SORTRULESET_NATPERS: string[] = [
  'AnredeId',
  'Vorname',
  'Name',
  'Vorsatz',
  'Zusatz',
  'Titel',
  'GebName',
  'GebDat',
  'Religion',
  'Berufsbez',
  'Adrkette',
  'SteuerIDs',
];

export class XMLBuilderTool implements XMLBuilderInterface {
  xmkKeyList: string[] = [];

  constructor(
    private localSecrets: LocalSecrets,
    private serverConfig: ServerConfig
  ) {}

  async buildXML(content: ShAnswers[], user: ShUser) {
    if (
      this.localSecrets.eric.finanzAmtId == null ||
      this.localSecrets.eric.finanzAmtId === ''
    )
      return;
    const contentWithCheckboxText = this.addJobCheckboxText(content);
    const contentFilled: EUn = this.fillStructure(contentWithCheckboxText);
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
        <DatenLieferant>ERiC Projekt</DatenLieferant>
        <Datei>
            <Verschluesselung>CMSEncryptedData</Verschluesselung>
            <Kompression>GZIP</Kompression>
            <TransportSchluessel/>
            <Erstellung/>
        </Datei>
        <VersionClient>ERiC Beispiele</VersionClient>
    </TransferHeader>
    <DatenTeil>
        <Nutzdatenblock>
            <NutzdatenHeader version="11">
                <NutzdatenTicket>11</NutzdatenTicket>
                <Empfaenger id="F">${this.localSecrets.eric.finanzAmtId}</Empfaenger>
            </NutzdatenHeader>
            <Nutzdaten>
                <FsE_EUn xmlns="http://finkonsens.de/elster/elsterfse/eun/v202301" version="202301">
                ${builtEUn}
                </FsE_EUn>
            </Nutzdaten>
        </Nutzdatenblock>
    </DatenTeil>
</Elster>`;
    return this.serverConfig.eric.devMode
      ? xmlFull
      : xmlFull.replace(/{{TESTMERKER}}/g, '');
  }

  addJobCheckboxText(content: ShAnswers[]) {
    if (content.find((e) => e.key.includes('#SteEr25a'))?.value === 'true') {
      content.find((e) => e.key === 'SteEr25')!.value +=
        ' Ich bin mir unsicher, ob ich eine Gewerbeanmeldung brauche und benötige dafür Rückmeldung vom Finanzamt.';
    }
    return content;
  }

  async fillDefaults(objToFill: EUn, answers: ShAnswers[], user: ShUser) {
    _.merge(objToFill, {
      Ordnungskriterium: { OrdNrArt: 'O' },
    });
    if (answers.find((e) => e.key === 'SteEr25' && e.value === 'Handwerk')) {
      _.merge(objToFill, {
        Freistellungsbescheinigung: {
          AntragFreistBauabzugsSt: 'true',
        },
      });
      _.merge(objToFill, {
        Umsatzsteuer: {
          SteuerschuldnerschaftLE: { NachweisBeantragt: 'true' },
        },
      });
    }
    if (
      objToFill.Umsatzsteuer.KleinunternehmerRegelung &&
      objToFill.Umsatzsteuer.KleinunternehmerRegelung.KleinUnternUSt === 'true'
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

    if (answers.find((a) => a.key === 'AuswahlSollIstVerst')) {
      _.merge(objToFill, {
        Umsatzsteuer: {
          SollIstVersteuerung: {
            AuswahlSollIstVerst: answers.find(
              (a) => a.key === 'AuswahlSollIstVerst'
            )?.value,
          },
        },
      });
    }

    if (answers.find((a) => a.xmlKey.includes('IstVerstUStGrundUmsatz'))) {
      _.merge(objToFill, {
        Umsatzsteuer: {
          SollIstVersteuerung: {
            IstVerstUStGrundUmsatz: 'true',
          },
        },
      });
    } else if (answers.find((a) => a.xmlKey.includes('IstVerstUStGrundAO'))) {
      _.merge(objToFill, {
        Umsatzsteuer: {
          SollIstVersteuerung: {
            IstVerstUStGrundAO: 'true',
          },
        },
      });
    } else if (
      answers.find((a) => a.xmlKey.includes('IstVerstUStGrundFreierBeruf'))
    ) {
      _.merge(objToFill, {
        Umsatzsteuer: {
          SollIstVersteuerung: {
            IstVerstUStGrundFreierBeruf: 'true',
          },
        },
      });
    }

    _.merge(objToFill, {
      Inhaber: {
        NatPers: {
          Vorname: user.firstName,
          Name: user.lastName,
          GebDat: user.dateOfBirth.replace(/-/g, ''),
        },
      },
    });

    if (user.title === 'Herr' || user.title === 'Frau') {
      _.merge(objToFill, {
        Inhaber: {
          NatPers: {
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
      _.merge(objToFill, {
        Inhaber: {
          NatPers: {
            Titel: user.academicTitle,
          },
        },
      });
    }

    // Parse street address correctly with the updated function
    const { streetName, houseNumber, hasNonNumericPart } = parseStreetAddress(
      user.street
    );

    const addressObject: any = {
      Inhaber: {
        NatPers: {
          Adrkette: {
            StrAdr: {
              Ort: user.city,
              Plz: user.postalCode,
              Str: streetName,
            },
          },
        },
      },
    };

    // Place the house number in the appropriate field based on whether it contains non-numeric characters
    if (hasNonNumericPart) {
      addressObject.Inhaber.NatPers.Adrkette.StrAdr.HausNrZu = houseNumber;
    } else {
      addressObject.Inhaber.NatPers.Adrkette.StrAdr.HausNr = houseNumber;
    }

    _.merge(objToFill, addressObject);

    return objToFill;
  }

  private fillStructure(content: ShAnswers[]) {
    const obj = {};
    for (const con of content) {
      const list = this.filterXmlKeys(con)?.reverse() ?? [];

      if (list.length !== 0 && list[0] !== '' && list[0] !== '?') {
        _.merge(obj, this.createDataStructure(list, con.value));
      }
    }
    return obj as EUn;
  }

  private createDataStructure(list: string[], val: string) {
    let obj: { [k: string]: string | object } = {};
    for (const xmlKeyIndex in list) {
      if (Number(xmlKeyIndex) === 0) {
        obj[list[xmlKeyIndex]] = this.sanatizeValues(val, list[xmlKeyIndex]);
      } else {
        obj = { [list[xmlKeyIndex]]: obj };
      }
    }

    return obj;
  }

  private sanatizeValues(val: string, key: string) {
    const recArr: Record<string, Record<string, string>> = {
      GewinnErmittlung: GEWINNERMITTLUNG,
      AnredeId: ANREDE,
      OrdNrArt: ORDNRART,
      Religion: RELIGION,
      GruendungsArt: GRUENDART,
      KleinUnternUSt: KLUNTREGELUNG,
      KleinUnternUStVerzicht: KLUNTREGELUNG,
      VoranmeldungMonatlich: VORANMELDUNG,
      Auswahl: ZLLÜBER,
    };
    let sVal = val;

    if (DATE_FIELDS.includes(key)) sVal = sVal.replace(/-/g, '');
    if (key === 'EntsprichtWohnanschrift') sVal = 'true';

    for (const rec of Object.keys(recArr)) {
      if (key === rec && Object.keys(recArr[rec]).includes(val))
        sVal = recArr[rec][val];
    }
    return sVal;
  }

  private logicAdj(EUn: EUn) {
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

  private filterXmlKeys(con: ShAnswers) {
    if (con.key.includes('SteEr') && !con.key.includes('?') && con.key !== '') {
      const pathObj = con.xmlKey.split('/');
      return pathObj;
    }
    return;
  }

  private sortObjectRecursively(
    obj: any,
    ruleSet: Record<string, string[]>
  ): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }

    const currentRuleSet = this.findApplicableRuleSet(obj, ruleSet);

    const sortedEntries = Object.entries(obj).sort(([keyA], [keyB]) => {
      const indexA = currentRuleSet.indexOf(keyA);
      const indexB = currentRuleSet.indexOf(keyB);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      if (indexA !== -1) {
        return -1;
      }

      if (indexB !== -1) {
        return 1;
      }

      return 0;
    });

    return Object.fromEntries(
      sortedEntries.map(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return [key, this.sortObjectRecursively(value, ruleSet)];
        }
        return [key, value];
      })
    );
  }

  private findApplicableRuleSet(
    obj: any,
    ruleSets: Record<string, string[]>
  ): string[] {
    if ('FragebogenTyp' in obj) {
      return ruleSets['root'];
    }

    // Address handling
    if ('Str' in obj && 'Plz' in obj) {
      return ruleSets['address'];
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
      'VornmeldungMonatlich' in obj
    ) {
      return ruleSets['zahllastUeberschuss'];
    }

    if ('Vorname' in obj && 'Religion' in obj) {
      return ruleSets['natPers'];
    }

    // Default to an empty array if no rule set matches
    return [];
  }

  public sortEUnObject(eunObj: EUn): EUn {
    const ruleSets: Record<string, string[]> = {
      root: SORTRULESET_ROOT,
      address: SORTRULESET_PLZ,
      unternehmen: SORTRULESET_UNTERNEHMEN,
      gruendungsArt: SORTRULESET_GRUENDUNGS_ART,
      zahllastUeberschuss: SORTRULESET_ZAHLLAST_UEBERSCHUSS,
      natPers: SORTRULESET_NATPERS,
    };

    return this.sortObjectRecursively(eunObj, ruleSets) as EUn;
  }
}
