import {
  Answers,
  formatDateToGerman,
  FormDataBuilder,
  FormDataInput,
  FormDataNode,
  OZGAntragsteller,
  OZGAttachment,
  OZGFormDataRequest,
  OZGInterface,
  ProfileInfo,
  ShUser,
  stringToBoolean,
} from '@startuphafen/startuphafen-common';
import { generateUUID } from '@startuphafen/utility';
import axios, { AxiosInstance } from 'axios';
import { jsPDF } from 'jspdf';
import _ from 'lodash';
import { ServerConfig } from '../../config';
import { buildOzgXml, buildTokenXml } from './ozg-xml-builder';

export class OZGTool implements OZGInterface {
  axi: AxiosInstance;
  antragEndPoint = '/antrag';

  control: ServerConfig['ozg']['control'] | null = null;

  constructor(config: ServerConfig) {
    this.axi = axios.create({
      baseURL: config.ozg.host,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (config.ozg.control != null) {
      this.control = { ...config.ozg.control };
    } else {
      console.log('Warn: config.ozg.control is not set, ozg will not work');
    }
  }

  private getControl(oeid?: string) {
    if (this.control == null)
      throw new Error('OZG.control not set, ozg does not work');

    const zustaendigeStelle = oeid ?? this.control.zustaendigeStelle;
    const organisationsEinheitenId =
      oeid ?? this.control.organisationsEinheitenId;

    return {
      transactionId: generateUUID(),
      ...this.control,
      zustaendigeStelle,
      organisationsEinheitenId,
    };
  }

  async postOZGFormData(
    formData: FormDataNode[],
    ozgDocBlob: Blob | null,
    identificationAttachments?: File[],
    attachments?: OZGAttachment[],
    overrideDomain?: string,
    overrideOeid?: string
  ) {
    try {
      const multipartForm = new FormData();

      const ozgInput: OZGFormDataRequest = {
        control: this.getControl(overrideOeid),
        formData: formData,
      };

      const axiosInstance = overrideDomain
        ? axios.create({
            baseURL: overrideDomain,
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        : this.axi;

      const formDataBlob = new Blob([JSON.stringify(ozgInput)], {
        type: 'application/json',
      });

      console.log('> Created Blob from data');

      multipartForm.append('formData', formDataBlob);

      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          const attachmentBlob = new Blob([attachment.content], {
            type: attachment.mimeType,
          });

          multipartForm.append(
            'attachment',
            attachmentBlob,
            attachment.filename
          );
        }
        console.log(`> ${attachments.length} attachment(s) added to Form`);
      }

      if (ozgDocBlob !== null) {
        multipartForm.append('attachment', ozgDocBlob, 'Gewerbeanmeldung.pdf');
      }

      if (identificationAttachments) {
        for (const file of identificationAttachments) {
          multipartForm.append('attachment', file, file.name);
        }
      }

      const response = await axiosInstance.post(
        this.antragEndPoint,
        multipartForm
      );
      console.log('> Send successful');
      return response.data;
    } catch (error: any) {
      const genericClientErrorMessage =
        'Die Übermittlung an das Gewerbeamt ist aktuell nicht möglich. Bitte versuche es später erneut.';

      console.log(`> Failed to post OZG form data: ${error.message}`);

      console.error(error);

      return {
        transactionId: '',
        vorgang: {
          vorgangId: '',
          vorgangNummer: '',
          status: '',
          statusSince: '',
        },
        errorMessage: genericClientErrorMessage,
      };
    }
  }

  filterIndustry(industry: string | null): string {
    if (industry === null) return '';
    if (['Handwerk', 'Industrie', 'Handel'].includes(industry)) {
      return industry;
    }
    if (industry === 'us1Ans-2') return 'Handwerk';
    if (industry === 'us1Ans-3') return 'Industrie';
    if (industry === 'us1Ans-5') return 'Handel';
    return 'Sonstiges';
  }

  createDocument(docData: FormDataInput, catalogueId: string) {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text(
        'Gewerbeanmeldung:  ' +
          docData['Angaben zum Betriebsinhaber']?.Projektname,
        35,
        35
      );
      doc.setFontSize(8);
      doc.text(new Date().toString(), 35, 40);

      doc.setFontSize(14);
      doc.text('Antragsstellende Person', 35, 50);
      doc.text('Betriebsdaten', 35, 140);

      doc.setFontSize(12);
      doc.text('Adresse', 35, 105);
      doc.text('Angemeldete Tätigkeit', 35, 175);

      doc.setFontSize(10);
      doc.text(
        'Staatsangehörigkeit     ' +
          docData['antragsteller'].pers_staatsangehoerigkeit,
        35,
        60
      );
      doc.text(
        'Nachname     ' + docData['antragsteller'].pers_nachname,
        35,
        65
      );
      doc.text('Vorname     ' + docData['antragsteller'].pers_vorname, 35, 70);
      doc.text(
        'Geburtsdatum     ' + docData['antragsteller'].pers_geburtsdatum,
        35,
        75
      );
      doc.text(
        'Telefonnummer     ' + docData['antragsteller'].kont_telefonnummer,
        35,
        80
      );
      doc.text(
        'Geburtsland     ' + docData['antragsteller'].pers_geburtsland,
        35,
        85
      );
      doc.text(
        'Geburtsort     ' + docData['antragsteller'].pers_geburtsort,
        35,
        90
      );
      doc.text(
        'Mobilnummer     ' + docData['antragsteller'].kont_mobilnummer,
        35,
        95
      );

      doc.text('Ort     ' + docData['antragsteller'].ort, 35, 115);
      doc.text('Straße     ' + docData['antragsteller'].sh_strasse, 35, 120);
      doc.text(
        'Hausnummer     ' + docData['antragsteller'].sh_hausnummer,
        35,
        125
      );
      doc.text('PLZ     ' + docData['antragsteller'].sh_plz, 35, 130);

      doc.text('Rechtsform   ' + docData.Betriebsdaten.Rechtsform, 35, 150);
      doc.text('Neugründung     Ja', 35, 155);
      doc.text('Hauptniederlassung     Ja', 35, 160);
      doc.text(
        'Art des Betriebes   ' + docData.Betriebsdaten['Art des Betriebes'],
        35,
        165
      );

      const nebenerwerb =
        docData.Betriebsdaten['Angemeldete Tätigkeit'].Nebenerwerb;
      doc.text('Nebenerwerb     ' + nebenerwerb, 35, 185);
      doc.text(
        'Beginn     ' + docData.Betriebsdaten['Angemeldete Tätigkeit'].Beginn,
        35,
        190
      );

      doc.text('Beschreibung     ', 35, 195);
      const splitDescription: string[] = doc.splitTextToSize(
        docData.Betriebsdaten['Angemeldete Tätigkeit'].Beschreibung,
        100
      );
      for (let i = 0; i < splitDescription.length; i++) {
        doc.text(splitDescription[i], 70, 195 + i * 5);
      }
      const splitDescriptionAddedHeight =
        Math.max(splitDescription.length - 1, 0) * 5;

      doc.setFontSize(12);
      doc.text('Vorliegende Erlaubnis', 35, 205 + splitDescriptionAddedHeight);
      doc.setFontSize(10);

      const erlaubnis =
        docData.Betriebsdaten['Vorliegende Erlaubnis'][
          'Unterliegt das Gewerbe einer Erlaubnispflicht'
        ];

      const erlaubnisLiegtVor =
        docData.Betriebsdaten['Vorliegende Erlaubnis'][
          'Liegt bereits eine Erlaubnis vor'
        ];

      doc.text(
        'Unterliegt das Gewerbe einer Erlaubnispflicht    ' + erlaubnis,
        35,
        215 + splitDescriptionAddedHeight
      );
      doc.text(
        'Liegt bereits eine Erlaubnis vor    ' + erlaubnisLiegtVor,
        35,
        220 + splitDescriptionAddedHeight
      );
      doc.text(
        'Ausstellende Behörde    ' +
          docData.Betriebsdaten['Vorliegende Erlaubnis'][
            'Ausstellende Behörde'
          ],
        35,
        225 + splitDescriptionAddedHeight
      );
      doc.text(
        'Ausstellungsdatum    ' +
          docData.Betriebsdaten['Vorliegende Erlaubnis']['Ausstellungsdatum'],
        35,
        230 + splitDescriptionAddedHeight
      );

      doc.setFontSize(6);
      doc.text(
        'Dieses Dokument wurde erstellt von startuphafen.sh. Es ist KEIN offizielles Dokument!',
        35,
        280
      );

      doc.addPage();

      doc.setFontSize(14);
      doc.text('Betriebsstätte', 35, 50);
      doc.text('Vorliegende Handwerkskarte', 35, 95);
      if (catalogueId === 'kapg') {
        doc.text('Geschäftsaufnahme', 35, 115);
        doc.text('Angaben zum Betriebsinhaber', 35, 145);
      }
      doc.setFontSize(10);

      doc.text('Ort     ' + docData.Betriebsdaten.Betriebsstätte?.Ort, 35, 60);
      doc.text(
        'Straße     ' + docData.Betriebsdaten.Betriebsstätte?.Straße,
        35,
        65
      );
      doc.text(
        'Hausnummer     ' + docData.Betriebsdaten.Betriebsstätte?.Hausnummer,
        35,
        70
      );
      doc.text('PLZ     ' + docData.Betriebsdaten.Betriebsstätte?.PLZ, 35, 75);

      if (catalogueId === 'kapg') {
        doc.text(
          'Telefonnummer     ' +
            docData.Betriebsdaten.Betriebsstätte?.Telefonnummer,
          35,
          80
        );
        doc.text(
          'Internetadresse     ' +
            docData.Betriebsdaten.Betriebsstätte?.Internetadresse,
          35,
          85
        );
      }

      const handwerkskarte =
        docData.Betriebsdaten['Vorliegende Handwerkskarte'][
          'Handwerkskarte liegt vor'
        ];
      doc.text('Handwerkskarte liegt vor     ' + handwerkskarte, 35, 105);

      // Vertical start of the trailing block (Quelle / Auth-Kommentar).
      // For eun this stays on the current page; for kapg it is moved below
      // the Beteiligte list (which is drawn on its own page with a growing y)
      // so the auth comment no longer overlaps the last Beteiligter.
      let tailY = 215;

      if (catalogueId === 'kapg') {
        doc.text(
          'Personen in Vollzeit    ' +
            docData.Betriebsdaten.Geschäftsaufnahme?.['Personen in Vollzeit'],
          35,
          125
        );
        doc.text(
          'Personen in Teilzeit    ' +
            docData.Betriebsdaten.Geschäftsaufnahme?.['Personen in Teilzeit'],
          35,
          130
        );
        doc.text(
          'Ehegatten oder Lebenspartner im Geschäft    ' +
            docData.Betriebsdaten.Geschäftsaufnahme?.[
              'Ehegatten oder Lebenspartner im Geschäft'
            ],
          35,
          135
        );

        const heintrag =
          docData['Angaben zum Betriebsinhaber'] == null
            ? 'Nein'
            : docData['Angaben zum Betriebsinhaber'][
                'Handelsregistereintrag wurde gestellt'
              ];

        const heintragErfolgt =
          docData['Angaben zum Betriebsinhaber'] == null
            ? 'Nein'
            : docData['Angaben zum Betriebsinhaber'][
                'Handelsregistereintrag ist erfolgt'
              ];

        doc.text(
          'Handelsregistereintrag wurde gestellt    ' + heintrag,
          35,
          155
        );
        doc.text(
          'Handelsregistereintrag ist erfolgt    ' + heintragErfolgt,
          35,
          160
        );
        doc.text(
          'Handelsregisternummer   ' +
            docData['Angaben zum Betriebsinhaber']?.Handelsregisternummer,
          35,
          165
        );
        doc.text(
          'Name laut Handelsregister   ' +
            docData['Angaben zum Betriebsinhaber']?.[
              'Name laut Handelsregister'
            ],
          35,
          170
        );

        doc.text(
          'Zahl der gesetzlichen Verteter  ' +
            docData.Betriebsdaten['Zahl der gesetzlichen Verteter'],
          35,
          185
        );

        const oeffentlicheHand =
          docData.Betriebsdaten[
            'Liegt eine Beteiligung der öffentlichen Hand vor'
          ] ?? 'Nein';

        doc.text(
          'Liegt eine Beteiligung der öffentlichen Hand vor   ' +
            oeffentlicheHand,
          35,
          190
        );

        doc.setFontSize(6);
        doc.text(
          'Dieses Dokument wurde erstellt von startuphafen.sh. Es ist KEIN offizielles Dokument!',
          35,
          280
        );
        doc.addPage();

        let y = 40;
        let i = 0;
        for (const beteiligter of docData.Betriebsdaten.Beteiligte ?? []) {
          i += 1;
          if (y + 65 > 260) {
            doc.setFontSize(6);
            doc.text(
              'Dieses Dokument wurde erstellt von startuphafen.sh. Es ist KEIN offizielles Dokument!',
              35,
              280
            );
            doc.addPage();
            y = 20;
          }
          y += 10;
          doc.setFontSize(12);
          doc.text(`Beteiligter #${i}`, 35, y);
          y += 5;
          doc.setFontSize(10);
          doc.text('Vorname     ' + beteiligter.Vorname, 35, y);
          y += 5;
          doc.text('Nachname     ' + beteiligter.Nachname, 35, y);
          y += 5;
          doc.text('Geburtsdatum     ' + beteiligter.Geburtsdatum, 35, y);
          y += 5;
          doc.text('SteuerId     ' + beteiligter.SteuerId, 35, y);
          y += 5;
          doc.text('Straße     ' + beteiligter.Adresse.Straße, 35, y);
          y += 5;
          doc.text('Hausnummer     ' + beteiligter.Adresse.Hausnummer, 35, y);
          y += 5;
          doc.text('PLZ     ' + beteiligter.Adresse.PLZ, 35, y);
          y += 5;
          doc.text('Ort     ' + beteiligter.Adresse.Ort, 35, y);
          y += 5;
          doc.text('Geburtsort     ' + beteiligter.Geburtsort, 35, y);
          y += 5;
          doc.text(
            'Staatsangehörigkeit     ' + beteiligter.Staatsangehörigkeit,
            35,
            y
          );
          y += 5;
          doc.text('Geschlecht     ' + beteiligter.Geschlecht, 35, y);
        }
        if (y + 50 > 260) {
          doc.setFontSize(6);
          doc.text(
            'Dieses Dokument wurde erstellt von startuphafen.sh. Es ist KEIN offizielles Dokument!',
            35,
            280
          );
          doc.addPage();
          tailY = 20;
        } else {
          tailY = y + 15;
        }
      }

      doc.text('Quelle     startuphafen.sh', 35, tailY);
      doc.text('Auth-Kommentar     ', 35, tailY + 10);
      const splitText: string[] = doc.splitTextToSize(
        docData['Auth-Kommentar'],
        100
      );
      for (let i = 0; i < splitText.length; i++) {
        doc.text(splitText[i], 70, tailY + 10 + i * 5);
      }

      doc.setFontSize(6);
      doc.text(
        'Dieses Dokument wurde erstellt von startuphafen.sh. Es ist KEIN offizielles Dokument!',
        35,
        280
      );

      const pdfBuffer = doc.output('arraybuffer');
      const uint8Array = new Uint8Array(pdfBuffer);

      return uint8Array;
    } catch (error: any) {
      console.error(error);

      return null;
    }
  }

  private stringToYesNo(value: string | null): 'Ja' | 'Nein' {
    return stringToBoolean(value) === true ? 'Ja' : 'Nein';
  }

  buildEUnJSON(
    user: ShUser,
    profileInfo: ProfileInfo,
    filtered: Answers[],
    config: ServerConfig,
    token: string,
    catalogueId: string,
    projectName: string,
    oeid?: string
  ) {
    const street = OZGTool.parseStreetAddress(user.street);

    const addressData = filtered.filter((e) => e.componentId === 'St68-71b');

    const antragsteller: OZGAntragsteller = {
      pers_anrede:
        user.title === 'Herr'
          ? 'männlich'
          : user.title === 'Frau'
          ? 'weiblich'
          : 'Keine Angabe',
      pers_nachname: user.lastName ?? '',
      pers_vorname: user.firstName ?? '',
      pers_geburtsname: '',
      pers_geburtsdatum: user.dateOfBirth ?? '',
      pers_geburtsort: profileInfo.birthPlace ?? '',
      pers_geburtsland: profileInfo.birthCountry ?? '',
      pers_staatsangehoerigkeit: user.country ?? '',
      sh_strasse: street.streetName ?? '',
      sh_hausnummer: street.houseNumber ?? '',
      sh_plz: user.postalCode.toString() ?? '',
      ort: user.city.toString() ?? '',
      kont_telefonnummer: profileInfo.phoneNumber
        ? `${profileInfo.phoneInternational}${profileInfo.phoneNational}${profileInfo.phoneNumber}`
        : user.phoneNumber,
      kont_mobilnummer: user.cellPhoneNumber ?? '',
      kont_telefaxnummer: '',
      kont_email: user.email.toString() ?? '',
      kont_demail: '',
      zeichen: '',
    };
    // Applicant person and business premises are currently hardcoded here.
    const formDataInput: FormDataInput = {
      antragsteller: antragsteller,
      Betriebsdaten: {
        'Angemeldete Tätigkeit': {
          Beginn: this.getValueFromDBAnswers(filtered, 'St96') ?? '',
          Nebenerwerb: this.stringToYesNo(
            this.getValueFromDBAnswers(filtered, 'Gw19')
          ),
          Beschreibung: this.getValueFromDBAnswers(filtered, 'St25') ?? '',
        },
        'Vorliegende Erlaubnis': {
          'Unterliegt das Gewerbe einer Erlaubnispflicht': this.stringToYesNo(
            this.getValueFromDBAnswers(filtered, 'Gw28_0')
          ),
          'Liegt bereits eine Erlaubnis vor': stringToBoolean(
            this.getValueFromDBAnswers(filtered, 'Gw28_0')
          )
            ? stringToBoolean(this.getValueFromDBAnswers(filtered, 'Gw28'))
              ? 'Ja'
              : 'Nein, hiermit möchte ich eine Erlaubnis beantragen'
            : 'Nein',
          'Ausstellende Behörde':
            this.getValueFromDBAnswers(filtered, 'Gw28a') ?? '',
          Ausstellungsdatum:
            this.getValueFromDBAnswers(filtered, 'Gw28b') ?? '',
        },
        'Vorliegende Handwerkskarte': {
          'Handwerkskarte liegt vor': this.stringToYesNo(
            this.getValueFromDBAnswers(filtered, 'Gw29')
          ),
          'Name der Handwerkskammer':
            this.getValueFromDBAnswers(filtered, 'Gw29a') ?? '',
          Ausstellungsdatum:
            this.getValueFromDBAnswers(filtered, 'Gw29b') ?? '',
        },
        'Art des Betriebes': this.filterIndustry(
          this.getValueFromDBAnswers(filtered, 'Us1')
        ),
        Rechtsform: 'Einzelunternehmen',
      },
      source: 'startuphafen.sh',
      'Auth-Kommentar': `Dieser Antrag wurde von Nutzer ${
        user.lastName === '' ? user.name : user.firstName + ' ' + user.lastName
      } angemeldet am ${formatDateToGerman(
        new Date()
      )} mit Autorisierungsniveau BundID-High und Token ${token.substring(
        0,
        10
      )} über das Startuphafen System übermittelt.`,
      OrganisationseinheitenID:
        oeid ?? config.ozg.control?.organisationsEinheitenId ?? '',
      inbox_reference: user.inboxReference ?? '',
    };

    _.merge(formDataInput, {
      'Angaben zum Betriebsinhaber': {
        Projektname: projectName,
      },
    });

    if (filtered.find((a) => a.key === 'St68')?.value === 'st68Ans-1') {
      _.merge(formDataInput.Betriebsdaten, {
        Betriebsstätte: {
          Hausnummer: street.houseNumber,
          Ort: user.city.toString(),
          PLZ: user.postalCode.toString(),
          Straße: street.streetName,
        },
      });
    } else if (addressData.length !== 0) {
      _.merge(formDataInput.Betriebsdaten, {
        Betriebsstätte: {
          Hausnummer: addressData.find((a) => a.key === 'St70a')?.value,
          Ort: addressData.find((a) => a.key === 'St71b')?.value,
          PLZ: addressData.find((a) => a.key === 'St71a')?.value,
          Straße: addressData.find((a) => a.key === 'St69')?.value,
        },
      });
    }

    if (formDataInput == null) return null;

    const formDataBuilder = new FormDataBuilder();
    const formDataBuild = formDataBuilder.build(formDataInput, catalogueId);

    const inboxReference = user.inboxReference ?? '';
    const xmlData = buildOzgXml({
      formData: formDataBuild,
      antragsteller,
      organisationsEinheitenId:
        oeid ?? config.ozg.control?.organisationsEinheitenId ?? '',
      inboxReference,
    });
    const xmlToken = buildTokenXml(token ?? 'NO_TOKEN');

    const attachments: OZGAttachment[] = [
      {
        filename: 'XML-Daten.xml',
        mimeType: 'application/xml',
        content: xmlData,
      },
      {
        filename: 'OIDC-Assertion.xml',
        mimeType: 'application/xml',
        content: xmlToken,
      },
    ];
    return {
      formDataBuild: formDataBuild,
      formDataInput: formDataInput,
      attachments: attachments,
    };
  }

  buildKapGJSON(
    user: ShUser,
    profileInfo: ProfileInfo,
    filtered: Answers[],
    config: ServerConfig,
    token: string,
    catalogueId: string,
    projectName: string,
    oeid?: string
  ) {
    const street = OZGTool.parseStreetAddress(user.street);

    const addressData = filtered.filter((e) => e.componentId === 'St3');

    const antragsteller: OZGAntragsteller = {
      pers_anrede:
        user.title === 'Herr'
          ? 'männlich'
          : user.title === 'Frau'
          ? 'weiblich'
          : 'Keine Angabe',
      pers_nachname: user.lastName ?? '',
      pers_vorname: user.firstName ?? '',
      pers_geburtsname: '',
      pers_geburtsdatum: user.dateOfBirth ?? '',
      pers_geburtsort: profileInfo.birthPlace ?? '',
      pers_geburtsland: profileInfo.birthCountry ?? '',
      pers_staatsangehoerigkeit: user.country ?? '',
      sh_strasse: street.streetName ?? '',
      sh_hausnummer: street.houseNumber ?? '',
      sh_plz: user.postalCode.toString() ?? '',
      ort: user.city.toString() ?? '',
      kont_telefonnummer: profileInfo.phoneNumber
        ? `${profileInfo.phoneInternational}${profileInfo.phoneNational}${profileInfo.phoneNumber}`
        : user.phoneNumber,
      kont_mobilnummer: user.cellPhoneNumber ?? '',
      kont_telefaxnummer: '',
      kont_email: user.email.toString() ?? '',
      kont_demail: '',
      zeichen: '',
    };

    // Applicant person and business premises are currently hardcoded here.
    const formDataInput: FormDataInput = {
      antragsteller: antragsteller,
      Betriebsdaten: {
        'Angemeldete Tätigkeit': {
          Beginn: this.getValueFromDBAnswers(filtered, 'St77') ?? '',
          Nebenerwerb: this.stringToYesNo(
            this.getValueFromDBAnswers(filtered, 'Gw19')
          ),
          Beschreibung: this.getValueFromDBAnswers(filtered, 'St15') ?? '',
        },
        'Vorliegende Erlaubnis': {
          'Unterliegt das Gewerbe einer Erlaubnispflicht': this.stringToYesNo(
            this.getValueFromDBAnswers(filtered, 'Gw28_0')
          ),
          'Liegt bereits eine Erlaubnis vor': stringToBoolean(
            this.getValueFromDBAnswers(filtered, 'Gw28_0')
          )
            ? stringToBoolean(this.getValueFromDBAnswers(filtered, 'Gw28'))
              ? 'Ja'
              : 'Nein, hiermit möchte ich eine Erlaubnis beantragen'
            : 'Nein',
          'Ausstellende Behörde':
            this.getValueFromDBAnswers(filtered, 'Gw28a') ?? '',
          Ausstellungsdatum:
            this.getValueFromDBAnswers(filtered, 'Gw28b') ?? '',
        },
        'Vorliegende Handwerkskarte': {
          'Handwerkskarte liegt vor': this.stringToYesNo(
            this.getValueFromDBAnswers(filtered, 'Gw29')
          ),
          'Name der Handwerkskammer':
            this.getValueFromDBAnswers(filtered, 'Gw29a') ?? '',
          Ausstellungsdatum:
            this.getValueFromDBAnswers(filtered, 'Gw29b') ?? '',
        },
        'Liegt eine Beteiligung der öffentlichen Hand vor': 'Nein',
        'Art des Betriebes': this.filterIndustry(
          this.getValueFromDBAnswers(filtered, 'HwkBranche')
        ),
        Rechtsform:
          this.getValueFromDBAnswers(filtered, 'St74') === '350'
            ? 'GmbH'
            : 'UG',
        Geschäftsaufnahme: {
          'Personen in Vollzeit': Number(
            this.getValueFromDBAnswers(filtered, 'St176a')
          ),
          'Personen in Teilzeit': Number(
            this.getValueFromDBAnswers(filtered, 'St176c')
          ),
          'Ehegatten oder Lebenspartner im Geschäft': Number(
            this.getValueFromDBAnswers(filtered, 'St176b')
          ),
        },
      },
      source: 'startuphafen.sh',
      'Auth-Kommentar': `Dieser Antrag wurde von Nutzer ${
        user.lastName === '' ? user.name : user.firstName + ' ' + user.lastName
      } angemeldet am ${formatDateToGerman(
        new Date()
      )} mit Autorisierungsniveau BundID-High und Token ${token.substring(
        0,
        10
      )} über das Startuphafen System übermittelt.`,
      OrganisationseinheitenID:
        oeid ?? config.ozg.control?.organisationsEinheitenId ?? '',
      inbox_reference: user.inboxReference ?? '',
    };

    const beteiligte = [];

    for (const i of this.naturalPersonFounderIndices(filtered)) {
      if (i === 0) {
        beteiligte.push({
          Vorname: antragsteller.pers_vorname,
          Nachname: antragsteller.pers_nachname,
          Geburtsdatum: antragsteller.pers_geburtsdatum,
          SteuerId: this.getValueFromDBAnswers(filtered, `St82o_${i}`) ?? '',
          Adresse: {
            Straße: antragsteller.sh_strasse,
            Hausnummer: antragsteller.sh_hausnummer,
            PLZ: antragsteller.sh_plz,
            Ort: antragsteller.ort,
          },
          Geburtsort: antragsteller.pers_geburtsort,
          Staatsangehörigkeit: antragsteller.pers_staatsangehoerigkeit,
          Geschlecht:
            antragsteller.pers_anrede === 'männlich'
              ? 'männlich'
              : antragsteller.pers_anrede === 'weiblich'
              ? 'weiblich'
              : 'Keine Angabe',
        });
        continue;
      }

      beteiligte.push({
        Vorname: this.getValueFromDBAnswers(filtered, `St83d_${i}`) ?? '',
        Nachname: this.getValueFromDBAnswers(filtered, `St83b_${i}`) ?? '',
        Geburtsdatum: this.getValueFromDBAnswers(filtered, `St83f_${i}`) ?? '',
        SteuerId: this.getValueFromDBAnswers(filtered, `St82o_${i}`) ?? '',
        Adresse: {
          Straße: this.getValueFromDBAnswers(filtered, `St83h_${i}`) ?? '',
          Hausnummer: this.getValueFromDBAnswers(filtered, `St83i_${i}`) ?? '',
          PLZ: this.getValueFromDBAnswers(filtered, `St83l_${i}`) ?? '',
          Ort: this.getValueFromDBAnswers(filtered, `St83m_${i}`) ?? '',
        },
        Geburtsort:
          this.getValueFromDBAnswers(filtered, `GwGeburtsort_${i}`) ?? '',
        Staatsangehörigkeit:
          this.getValueFromDBAnswers(filtered, `GwStaat_${i}`) ?? '',
        Geschlecht:
          this.getValueFromDBAnswers(filtered, `GwGeschlecht_${i}`) ?? '',
      });
    }

    _.merge(formDataInput.Betriebsdaten, {
      Beteiligte: beteiligte,
    });

    formDataInput.Betriebsdaten['Zahl der gesetzlichen Verteter'] = Math.max(
      beteiligte.length,
      1
    );

    _.merge(formDataInput, {
      'Angaben zum Betriebsinhaber': {
        Projektname: projectName,
        'Handelsregistereintrag wurde gestellt': 'Ja',
        'Handelsregistereintrag ist erfolgt': 'Ja',
        Handelsregisternummer: this.getValueFromDBAnswers(filtered, 'St68c'),
        'Name laut Handelsregister':
          this.getValueFromDBAnswers(filtered, 'St3') +
          ' ' +
          (this.getValueFromDBAnswers(filtered, 'St74') === '350'
            ? 'GmbH'
            : 'UG'),
      },
    });

    _.merge(formDataInput.Betriebsdaten, {
      Betriebsstätte: {
        Hausnummer: addressData.find((a) => a.key === 'St5a')?.value,
        Ort: addressData.find((a) => a.key === 'St6b')?.value,
        PLZ: addressData.find((a) => a.key === 'St6a')?.value,
        Straße: addressData.find((a) => a.key === 'St4')?.value,
        Telefonnummer:
          this.getValueFromDBAnswers(filtered, 'St12a') +
          ' ' +
          this.getValueFromDBAnswers(filtered, 'St12b') +
          ' ' +
          this.getValueFromDBAnswers(filtered, 'St12c'),
        Internetadresse: this.getValueFromDBAnswers(filtered, 'St14') ?? '',
      },
    });

    if (formDataInput == null) return null;

    const formDataBuilder = new FormDataBuilder();
    const formDataBuild = formDataBuilder.build(formDataInput, catalogueId);

    const inboxReference = user.inboxReference ?? '';
    const xmlData = buildOzgXml({
      formData: formDataBuild,
      antragsteller,
      organisationsEinheitenId:
        oeid ?? config.ozg.control?.organisationsEinheitenId ?? '',
      inboxReference,
    });
    const xmlToken = buildTokenXml(token ?? 'NO_TOKEN');

    const attachments: OZGAttachment[] = [
      {
        filename: 'XML-Daten.xml',
        mimeType: 'application/xml',
        content: xmlData,
      },
      {
        filename: 'OIDC-Assertion.xml',
        mimeType: 'application/xml',
        content: xmlToken,
      },
    ];
    return {
      formDataBuild: formDataBuild,
      formDataInput: formDataInput,
      attachments: attachments,
    };
  }

  private getValueFromDBAnswers(answers: Answers[], key: string) {
    const answer = answers.find((e) => e.key === key);
    if (answer == null) return null;
    return answer.stringValue == null ? answer.value : answer.stringValue;
  }

  /**
   * Parses a street address string into street name and house number
   * @param street Full street address
   * @returns Object containing streetName and houseNumber
   */
  static parseStreetAddress(street: string): {
    streetName: string;
    houseNumber: string;
  } {
    // Match house number patterns including ranges (e.g., 21-30, 2a-2f)
    // This regex matches:
    // - Simple house numbers like "15" or "3a"
    // - Ranges like "21-30" or "2a-2f"
    const match = street.match(/\s+(\d+\w*(?:-\d+\w*)?)\s*$/);

    if (match) {
      const houseNumber = match[1];
      // Remove the house number part from the street string and trim
      const streetName = street
        .substring(0, street.lastIndexOf(match[0]))
        .trim();
      return { streetName, houseNumber };
    }

    // Fallback if no house number is found
    return { streetName: street, houseNumber: '' };
  }

  private naturalPersonFounderIndices(filtered: Answers[]): number[] {
    return Array.from(
      Array.from(
        new Set(
          filtered
            .filter((answer) => answer.key.startsWith('St82o_'))
            .map((answer) => Number(answer.key.split('_')[1]))
            .filter((value) => !Number.isNaN(value))
        )
      )
    );
  }
}
