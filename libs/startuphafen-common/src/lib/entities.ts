import { z } from 'zod';
import {
  hwkMailLogSchema,
  projectSchema,
  userDocumentSchema,
} from '../generated/db-entities';

export const gewaDisabledAnswers = ['us1Ans-4', 'us1Ans-1'];

export const StrapiType = z.object({
  id: z.number(),
  documentId: z.string(),
});
export type StrapiType = z.infer<typeof StrapiType>;

export const ArticleCategory = z
  .object({
    categoryName: z.string(),
  })
  .merge(StrapiType);
export type ArticleCategory = z.infer<typeof ArticleCategory>;

export const ArticleIcon = z
  .object({
    name: z.string(),
    alternativeText: z.string().nullable(),
    caption: z.null(),
    width: z.number(),
    height: z.number(),
    formats: z.object({}).nullable(),
    hash: z.string(),
    ext: z.string(),
    mime: z.string(),
    size: z.number(),
    url: z.string(),
    previewUrl: z.null(),
    provider: z.string(),
    provider_metadata: z.null(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .merge(StrapiType);
export type ArticleIcon = z.infer<typeof ArticleIcon>;

export const Artikel = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().nullable().optional(),
    body: z.string().optional(),
    icon: ArticleIcon.nullable().optional(),
    articleCategory: ArticleCategory.optional(),
  })
  .merge(StrapiType);
export type Artikel = z.infer<typeof Artikel>;

export const FAQItem = z
  .object({
    question: z.string().optional(),
    answer: z.string().optional(),
  })
  .merge(StrapiType);
export type FAQItem = z.infer<typeof FAQItem>;

export interface Faq {
  header: string;
  content: string;
  isOpen: boolean;
}

export const Contact = z.object({
  group: z.string(),
  name: z.string(),
  unternehmen: z.string(),
  mailadresse: z.string(),
  telefon: z.string(),
  funktion: z.string(),
  foto: z.any().nullable(),
  kontaktlink: z.string().nullable(),
  kreis: z.string().nullish(),
});
export type Contact = z.infer<typeof Contact>;

export const FormData = z.object({
  userId: z.string(),
  formId: z.number(),
  formData: z.any(),
});
export type FormData = z.infer<typeof FormData>;

export const WebsiteText = z.object({
  id: z.number(),
  title: z.string().nullish(),
  placeToPut: z.string(),
  extraLabel: z.string().nullish(),
  icon: z.any().nullish(),
  text: z.string().nullish(),
});
export type WebsiteText = z.infer<typeof WebsiteText>;

export interface CMSInterface {
  getContentList: (contentName: string, filters?: string[]) => Promise<any[]>;
  getContent: (contentName: string, documentId: string) => Promise<any>;
  searchArticle: (
    contentName: string,
    searchString: string
  ) => Promise<Artikel[]>;
  getWebsiteText: (placeToPutList: string[]) => Promise<WebsiteText[]>;
  getContacts: (contentName: string, kreis: string) => Promise<Contact[]>;
  getKreis: (plz: string) => Promise<string>;
}

export interface EricToolInterface {
  makeEricCall: (input: EricHandleProcessInput) => Promise<string>;
}

export const EricPrintParam = z.object({
  preview: z.number(),
  duplexPrint: z.number(),
  footTxt: z.string(),
});
export type EricPrintParam = z.infer<typeof EricPrintParam>;

export const EricHandleProcessInput = z.object({
  xmlData: z.string(),
  elsterProcedureVersion: z.string(),
  processFlags: z.array(z.string()),
  ericPrintParam: EricPrintParam,
});
export type EricHandleProcessInput = z.infer<typeof EricHandleProcessInput>;

export const ValueType = z.enum(['string', 'date', 'boolean']);
export type ValueType = z.infer<typeof ValueType>;

export const FormDataField = z.object({
  name: z.string(),
  label: z.string(),
  type: ValueType,
});
export type FormDataField = z.infer<typeof FormDataField>;

// We need to declare the type first due to recursive nature
export const FormDataNode: z.ZodType<{
  name: string;
  label: string;
  formItems: (
    | z.infer<typeof FormDataField>
    | { name: string; label: string; formItems: any[] }
  )[];
}> = z.object({
  name: z.string(),
  label: z.string(),
  formItems: z.lazy(() => z.array(z.union([FormDataField, FormDataNode]))),
});
export type FormDataNode = z.infer<typeof FormDataNode>;

export type FormDataItem = FormDataField | FormDataNode;

export const OZGAntragsteller = z.object({
  pers_anrede: z.string(),
  pers_nachname: z.string(),
  pers_vorname: z.string(),
  pers_geburtsname: z.string(),
  pers_geburtsdatum: z.string(),
  pers_geburtsort: z.string(),
  pers_geburtsland: z.string(),
  pers_staatsangehoerigkeit: z.string(),
  sh_strasse: z.string(),
  sh_hausnummer: z.string(),
  sh_plz: z.string(),
  ort: z.string(),
  kont_telefonnummer: z.string(),
  kont_mobilnummer: z.string(),
  kont_telefaxnummer: z.string(),
  kont_email: z.string(),
  kont_demail: z.string(),
  zeichen: z.string(),
});
export type OZGAntragsteller = z.infer<typeof OZGAntragsteller>;

export const FormDataInput = z.object({
  antragsteller: OZGAntragsteller,
  Betriebsdaten: z.object({
    Betriebsstätte: z
      .object({
        Straße: z.string(),
        Hausnummer: z.string(),
        PLZ: z.string(),
        Ort: z.string(),
        Telefonnummer: z.string().optional(),
        Internetadresse: z.string().optional(),
      })
      .optional(),
    'Angemeldete Tätigkeit': z.object({
      Nebenerwerb: z.enum(['Ja', 'Nein']),
      Beginn: z.union([z.date(), z.string()]),
      Beschreibung: z.string(),
    }),
    'Vorliegende Erlaubnis': z.object({
      'Unterliegt das Gewerbe einer Erlaubnispflicht': z.enum(['Ja', 'Nein']),
      'Liegt bereits eine Erlaubnis vor': z.enum([
        'Ja',
        'Nein',
        'Nein, hiermit möchte ich eine Erlaubnis beantragen',
      ]),
      'Ausstellende Behörde': z.union([z.string(), z.null()]),
      Ausstellungsdatum: z.union([z.string(), z.null()]),
    }),
    'Vorliegende Handwerkskarte': z.object({
      'Handwerkskarte liegt vor': z.enum(['Ja', 'Nein']),
      'Name der Handwerkskammer': z.union([z.string(), z.null()]),
      Ausstellungsdatum: z.union([z.string(), z.null()]),
    }),
    //optional as its currently only in Kapg
    'Zahl der gesetzlichen Verteter': z.number().optional(),
    Firmenname: z.string().optional(),
    // Legal form of the company: 'Einzelunternehmen' | 'GbR' | 'GmbH' | 'UG'
    Rechtsform: z.string().optional(),
    'Liegt eine Beteiligung der öffentlichen Hand vor': z
      .enum(['Ja', 'Nein'])
      .optional(),
    'Art des Betriebes': z.string().optional(),
    Geschäftsaufnahme: z
      .object({
        'Personen in Vollzeit': z.number().optional(),
        'Personen in Teilzeit': z.number().optional(),
        'Ehegatten oder Lebenspartner im Geschäft': z.number().optional(),
      })
      .optional(),
    'Die Anmeldung wird erstattet für': z.string().optional(),
    Beteiligte: z
      .array(
        z.object({
          Vorname: z.string(),
          Nachname: z.string(),
          Geburtsdatum: z.string(),
          SteuerId: z.string(),
          Adresse: z.object({
            Straße: z.string(),
            Hausnummer: z.string(),
            PLZ: z.string(),
            Ort: z.string(),
          }),
          Geburtsort: z.string(),
          Staatsangehörigkeit: z.string(),
          Geschlecht: z.string(),
        })
      )
      .optional(),
  }),
  'Angaben zum Betriebsinhaber': z
    .object({
      Projektname: z.string(),
      'Handelsregistereintrag wurde gestellt': z.enum(['Ja', 'Nein']),
      'Handelsregistereintrag ist erfolgt': z.enum(['Ja', 'Nein']),
      Handelsregisternummer: z.string(),
      'Name laut Handelsregister': z.string(),
    })
    .optional(),
  source: z.string(),
  'Auth-Kommentar': z.string().min(1),
  OrganisationseinheitenID: z.string(),
  inbox_reference: z.string(),
});
export type FormDataInput = z.infer<typeof FormDataInput>;

const OZGControl = z.object({
  transactionId: z.string(),
  zustaendigeStelle: z.string(),
  leikaIds: z.array(z.string()),
  formId: z.string(),
  name: z.string(),
  serviceKonto: z.object({
    type: z.string(),
    trustLevel: z.string(),
    postfachAddress: z.object({
      identifier: z.string(),
      type: z.string(),
    }),
  }),
});

export const OZGResponse = z.object({
  transactionId: z.string(),
  vorgang: z.object({
    vorgangId: z.string(),
    vorgangNummer: z.string(),
    status: z.string(),
    statusSince: z.string(),
  }),
  errorMessage: z.string().optional(),
  documentBlob: z.any().optional(),
});
export type OZGResponse = z.infer<typeof OZGResponse>;

export interface OZGAttachment {
  filename: string;
  mimeType: string;
  content: string;
}

export const OZGFormDataRequest = z.object({
  control: OZGControl,
  formData: z.array(FormDataNode),
});
export type OZGFormDataRequest = z.infer<typeof OZGFormDataRequest>;
export interface OZGInterface {
  postOZGFormData: (
    formData: FormDataNode[],
    ozgDocBlob: Blob | null,
    identificationAttachments?: File[],
    attachments?: OZGAttachment[],
    overrideDomain?: string,
    overrideOeid?: string
  ) => Promise<OZGResponse>;
  createDocument: (
    docData: FormDataInput,
    catalogueId: string
  ) => Uint8Array | null;
}

export const LoginPageTexts = z.object({
  title: z.string().default(''),
  subtitle: z.string().default(''),
  content: z.string().default(''),
  loginButton: z.string().default(''),
  registerButton: z.string().default(''),
});
export type LoginPageTexts = z.infer<typeof LoginPageTexts>;

export const EricRes = z.object({
  msg: z.string(),
  pdf: z
    .object({
      type: z.literal('Uint8Array'),
      data: z.instanceof(Uint8Array),
    })
    .optional(),
  ericResponse: z
    .object({
      ericCode: z.number(),
      ericMessage: z.string(),
      returnBuffer: z.string().optional(),
      serverAnswewr: z.string().optional(),
    })
    .optional(),
});
export type EricRes = z.infer<typeof EricRes>;

export const AnswerObject = z.record(
  z.string(),
  z.object({
    value: z.unknown(),
    type: z.string(),
    xmlKey: z.string(),
    componentId: z.string(),
    stringValue: z.union([z.string(), z.number(), z.boolean()]).nullable(),
    questionText: z.string(),
    answerText: z.string(),
    headerText: z.string().nullable(),
  })
);
export type AnswerObject = z.infer<typeof AnswerObject>;

export const HWK_AI_ANSWER_KEY = 'HwkAi';
export const HWK_DOCUMENT_CASES = [
  'hwk_qualification_proof',
  'hwk_hr_extract',
] as const;
export const MAX_HWK_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const HwkDocumentCaseSchema = z.enum(HWK_DOCUMENT_CASES);
export type HwkDocumentCase = z.infer<typeof HwkDocumentCaseSchema>;
const HwkProjectDocumentSchema = userDocumentSchema
  .pick({
    id: true,
    filename: true,
    mimeType: true,
    createdAt: true,
    documentCase: true,
    data: true,
  })
  .extend({
    documentCase: HwkDocumentCaseSchema,
  });

const ProjectDocumentMetadataSchema = userDocumentSchema.pick({
  id: true,
  filename: true,
  mimeType: true,
  createdAt: true,
});

const HwkProjectDocumentMetadataSchema = HwkProjectDocumentSchema.omit({
  data: true,
});

const HWK_AI_CLASSIFICATIONS = [
  'kein Handwerksrolle',
  'Handwerksrolle',
  'zulassungsfreien Handwerksbetriebe',
  'handwerksähnlichen Gewerbebetriebe',
] as const;

export const HwkAiClassification = z
  .enum(HWK_AI_CLASSIFICATIONS)
  .describe(
    'Erlaubte Werte: "kein Handwerksrolle", "Handwerksrolle", "zulassungsfreien Handwerksbetriebe", "handwerksähnlichen Gewerbebetriebe".'
  );
export type HwkAiClassification = z.infer<typeof HwkAiClassification>;

export const HWK_AI_BRANCHES = [
  'Land- und Forstwirtschaft, Fischerei',
  'Handwerk',
  'Industrie',
  'Freie Berufe (Ärzte, Rechtsanwälte, Steuerberater, Journalisten, Künstler und Wissenschaftler)',
  'Handel',
  'Verkehr & Lagerei',
  'Tourismus, Gastronomie & Gastgewerbe',
  'Information & Kommunikation',
  'Dienstleistungen',
] as const;

const HwkAiBranch = z
  .enum(HWK_AI_BRANCHES)
  .describe(
    'Erlaubte Werte: "Land- und Forstwirtschaft, Fischerei", "Handwerk", "Industrie", "Freie Berufe", "Handel", "Verkehr & Lagerei", "Tourismus, Gastronomie & Gastgewerbe", "Information & Kommunikation", "Dienstleistungen".'
  );
type HwkAiBranch = z.infer<typeof HwkAiBranch>;

const handwerkGewerbeListAnlageA = [
  'Maurer und Betonbauer (Anlage A)',
  'Ofen- und Luftheizungsbauer (Anlage A)',
  'Zimmerer (Anlage A)',
  'Dachdecker (Anlage A)',
  'Straßenbauer (Anlage A)',
  'Wärme-, Kälte- und Schallschutzisolierer (Anlage A)',
  'Brunnenbauer (Anlage A)',
  'Steinmetzen und Steinbildhauer (Anlage A)',
  'Stuckateure (Anlage A)',
  'Maler und Lackierer (Anlage A)',
  'Gerüstbauer (Anlage A)',
  'Schornsteinfeger (Anlage A)',
  'Metallbauer (Anlage A)',
  'Chirurgiemechaniker (Anlage A)',
  'Karosserie- und Fahrzeugbauer (Anlage A)',
  'Feinwerkmechaniker (Anlage A)',
  'Zweiradmechaniker (Anlage A)',
  'Kälteanlagenbauer (Anlage A)',
  'Informationstechniker (Anlage A)',
  'Kraftfahrzeugtechniker (Anlage A)',
  'Land- und Baumaschinenmechatroniker (Anlage A)',
  'Büchsenmacher (Anlage A)',
  'Klempner (Anlage A)',
  'Installateur und Heizungsbauer (Anlage A)',
  'Elektrotechniker (Anlage A)',
  'Elektromaschinenbauer (Anlage A)',
  'Tischler (Anlage A)',
  'Boots- und Schiffbauer (Anlage A)',
  'Seiler (Anlage A)',
  'Bäcker (Anlage A)',
  'Konditoren (Anlage A)',
  'Fleischer (Anlage A)',
  'Augenoptiker (Anlage A)',
  'Hörakustiker (Anlage A)',
  'Orthopädietechniker (Anlage A)',
  'Orthopädieschuhmacher (Anlage A)',
  'Zahntechniker (Anlage A)',
  'Friseure (Anlage A)',
  'Glaser (Anlage A)',
  'Glasbläser und Glasapparatebauer (Anlage A)',
  'Mechaniker für Reifen- und Vulkanisationstechnik (Anlage A)',
  'Fliesen-, Platten- und Mosaikleger (Anlage A)',
  'Werkstein- und Terrazzohersteller (Anlage A)',
  'Estrichleger (Anlage A)',
  'Behälter- und Apparatebauer (Anlage A)',
  'Parkettleger (Anlage A)',
  'Rollladen- und Sonnenschutztechniker (Anlage A)',
  'Drechsler (Elfenbeinschnitzer) und Holzspielzeugmacher (Anlage A)',
  'Böttcher (Anlage A)',
  'Glasveredler (Anlage A)',
  'Schilder- und Lichtreklamehersteller (Anlage A)',
  'Raumausstatter (Anlage A)',
  'Orgel- und Harmoniumbauer (Anlage A)',
] as const;

const handwerkGewerbeListAnlageB1 = [
  'Uhrmacher (Anlage B1)',
  'Graveure (Anlage B1)',
  'Metallbildner (Anlage B1)',
  'Galvaniseure (Anlage B1)',
  'Metall- und Glockengießer (Anlage B1)',
  'Präzisionswerkzeugmechaniker (Anlage B1)',
  'Gold- und Silberschmiede (Anlage B1)',
  'Modellbauer (Anlage B1)',
  'Holzbildhauer (Anlage B1)',
  'Korb- und Flechtwerkgestalter (Anlage B1)',
  'Maßschneider (Anlage B1)',
  'Textilgestalter (Sticker, Weber, Klöppler, Posamentierer, Stricker) (Anlage B1)',
  'Modisten (Anlage B1)',
  'Segelmacher (Anlage B1)',
  'Kürschner (Anlage B1)',
  'Schuhmacher (Anlage B1)',
  'Sattler und Feintäschner (Anlage B1)',
  'Müller (Anlage B1)',
  'Brauer und Mälzer (Anlage B1)',
  'Weinküfer (Anlage B1)',
  'Textilreiniger (Anlage B1)',
  'Wachszieher (Anlage B1)',
  'Gebäudereiniger (Anlage B1)',
  'Feinoptiker (Anlage B1)',
  'Glas- und Porzellanmaler (Anlage B1)',
  'Edelsteinschleifer und -graveure (Anlage B1)',
  'Fotografen (Anlage B1)',
  'Buchbinder (Anlage B1)',
  'Print- und Medientechnologen (Drucker, Siebdrucker, Flexografen) (Anlage B1)',
  'Keramiker (Anlage B1)',
  'Klavier- und Cembalobauer (Anlage B1)',
  'Handzuginstrumentenmacher (Anlage B1)',
  'Geigenbauer (Anlage B1)',
  'Bogenmacher (Anlage B1)',
  'Metallblasinstrumentenmacher (Anlage B1)',
  'Holzblasinstrumentenmacher (Anlage B1)',
  'Zupfinstrumentenmacher (Anlage B1)',
  'Vergolder (Anlage B1)',
  'Holz- und Bautenschützer (Mauerschutz und Holzimprägnierung in Gebäuden) (Anlage B1)',
  'Bestatter (Anlage B1)',
  'Kosmetiker (Anlage B1)',
] as const;

const handwerkGewerbeListAnlageB2 = [
  'Eisenflechter (Anlage B2)',
  'Bautentrocknungsgewerbe (Anlage B2)',
  'Bodenleger (Anlage B2)',
  'Asphaltierer (ohne Straßenbau) (Anlage B2)',
  'Fuger (im Hochbau) (Anlage B2)',
  'Rammgewerbe (Einrammen von Pfählen im Wasserbau) (Anlage B2)',
  'Betonbohrer und -schneider (Anlage B2)',
  'Theater- und Ausstattungsmaler (Anlage B2)',
  'Herstellung von Drahtgestellen für Dekorationszwecke in Sonderanfertigung (Anlage B2)',
  'Metallschleifer und Metallpolierer (Anlage B2)',
  'Metallsägen-Schärfer (Anlage B2)',
  'Tankschutzbetriebe (Korrosionsschutz von Öltanks für Feuerungsanlagen ohne chemische Verfahren) (Anlage B2)',
  'Fahrzeugverwerter (Anlage B2)',
  'Rohr- und Kanalreiniger (Anlage B2)',
  'Kabelverleger im Hochbau (ohne Anschlussarbeiten) (Anlage B2)',
  'Holzschuhmacher (Anlage B2)',
  'Holzblockmacher (Anlage B2)',
  'Daubenhauer (Anlage B2)',
  'Holz-Leitermacher (Sonderanfertigung) (Anlage B2)',
  'Muldenhauer (Anlage B2)',
  'Holzreifenmacher (Anlage B2)',
  'Holzschindelmacher (Anlage B2)',
  'Einbau von genormten Baufertigteilen (zum Beispiel Fenster, Türen, Zargen, Regale) (Anlage B2)',
  'Bürsten- und Pinselmacher (Anlage B2)',
  'Bügelanstalten für Herren-Oberbekleidung (Anlage B2)',
  'Dekorationsnäher (ohne Schaufensterdekoration) (Anlage B2)',
  'Fleckteppichhersteller (Anlage B2)',
  'Theaterkostümnäher (Anlage B2)',
  'Plisseebrenner (Anlage B2)',
  'Stoffmaler (Anlage B2)',
  'Textil-Handdrucker (Anlage B2)',
  'Kunststopfer (Anlage B2)',
  'Änderungsschneider (Anlage B2)',
  'Handschuhmacher (Anlage B2)',
  'Ausführung einfacher Schuhreparaturen (Anlage B2)',
  'Gerber (Anlage B2)',
  'Innerei-Fleischer (Kuttler) (Anlage B2)',
  'Speiseeishersteller (mit Vertrieb von Speiseeis mit üblichem Zubehör) (Anlage B2)',
  'Fleischzerleger, Ausbeiner (Anlage B2)',
  'Appreteure, Dekateure (Anlage B2)',
  'Schnellreiniger (Anlage B2)',
  'Teppichreiniger (Anlage B2)',
  'Getränkeleitungsreiniger (Anlage B2)',
  'Maskenbildner (Anlage B2)',
  'Lampenschirmhersteller (Sonderanfertigung) (Anlage B2)',
  'Klavierstimmer (Anlage B2)',
  'Theaterplastiker (Anlage B2)',
  'Requisiteure (Anlage B2)',
  'Schirmmacher (Anlage B2)',
  'Steindrucker (Anlage B2)',
  'Schlagzeugmacher (Anlage B2)',
] as const;

const handwerkGewerbeList = [
  ...handwerkGewerbeListAnlageA,
  ...handwerkGewerbeListAnlageB1,
  ...handwerkGewerbeListAnlageB2,
] as const;

export const HWK_AI_KNOWN_TRADES = handwerkGewerbeList;

const HWK_AI_UNKNOWN_TRADE =
  'Keine eindeutige Zuordnung gemäß Anlage A, B1 oder B2 möglich.' as const;

const handwerkGewerbeSchema = z.union([
  z.enum(handwerkGewerbeList),
  z.literal(HWK_AI_UNKNOWN_TRADE),
]);

const handwerkGewerbeArraySchema = z.array(handwerkGewerbeSchema);

const HwkAiTradesSchema = handwerkGewerbeArraySchema
  .min(1)
  .describe(
    'Eine oder mehrere Angaben des Handwerks/Gewerbes gemäß Übersicht der Anlage A, B1, B2.'
  );

const HwkAiRequiresPermitSchema = z
  .boolean()
  .describe(
    'true, wenn für die beschriebene Tätigkeit eine Erlaubnispflicht besteht; sonst false.'
  );

export const HwkAiResultSchema = z
  .object({
    classification: HwkAiClassification,
    branch: HwkAiBranch.nullable(),
    requiresPermit: HwkAiRequiresPermitSchema.default(true),
    shortDescription: z
      .string()
      .min(1)
      .max(300)
      .describe(
        'Kurze allgemeine Tätigkeitsbeschreibung mit maximal 300 Zeichen.'
      ),
    trades: HwkAiTradesSchema,
    reasoning: z
      .string()
      .trim()
      .min(1)
      .max(1200)
      .optional()
      .describe('Kurze, menschenlesbare Begründung der KI-Einordnung.'),
  })
  .describe('Antwortformat für die HWK-AI-Vorprüfung.');
export type HwkAiResult = z.infer<typeof HwkAiResultSchema>;

export const parseStoredHwkAiResultValue = (
  value: unknown
): HwkAiResult | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    return null;
  }

  const currentResult = HwkAiResultSchema.safeParse(parsedValue);
  if (!currentResult.success) {
    return null;
  }

  return currentResult.data;
};

export const AntragFormFieldsSchema = z.object({
  entry_handwerksrolle_checkbox: z.boolean().optional(),
  entry_zulassungsfreie_checkbox: z.boolean().optional(),
  entry_handwerksaehnliche_checkbox: z.boolean().optional(),
  person_a_name: z.string().optional(),
  person_b_name: z.string().optional(),
  person_a_gender_male_checkbox: z.boolean().optional(),
  person_a_gender_female_checkbox: z.boolean().optional(),
  person_b_gender_male_checkbox: z.boolean().optional(),
  person_b_gender_female_checkbox: z.boolean().optional(),
  person_a_nationality: z.string().optional(),
  person_b_nationality: z.string().optional(),
  person_a_birth_date: z.string().optional(),
  person_a_birth_place: z.string().optional(),
  person_b_birth_date: z.string().optional(),
  person_b_birth_place: z.string().optional(),
  person_a_address: z.string().optional(),
  person_b_address: z.string().optional(),
  legal_form_einzelunternehmen_checkbox: z.boolean().optional(),
  legal_form_gbr_checkbox: z.boolean().optional(),
  legal_form_ohg_checkbox: z.boolean().optional(),
  legal_form_gmbh_checkbox: z.boolean().optional(),
  legal_form_gmbh_co_kg_checkbox: z.boolean().optional(),
  legal_form_kg_checkbox: z.boolean().optional(),
  legal_form_ag_checkbox: z.boolean().optional(),
  legal_form_ug_checkbox: z.boolean().optional(),
  legal_form_other: z.string().optional(),
  legal_form_other_checkbox: z.boolean().optional(),
  commercial_register_no_checkbox: z.boolean().optional(),
  commercial_register_company_name: z.string().optional(),
  commercial_register_yes_checkbox: z.boolean().optional(),
  reason_new_foundation_checkbox: z.boolean().optional(),
  reason_succession_checkbox: z.boolean().optional(),
  reason_change_legal_form_checkbox: z.boolean().optional(),
  reason_business_expansion_checkbox: z.boolean().optional(),
  relocation_from_address: z.string().optional(),
  relocation_checkbox: z.boolean().optional(),
  predecessor_name_address: z.string().optional(),
  takeover_checkbox: z.boolean().optional(),
  business_address_street: z.string().optional(),
  business_phone: z.string().optional(),
  business_mobile: z.string().optional(),
  business_postcode_city: z.string().optional(),
  business_fax: z.string().optional(),
  business_email: z.string().optional(),
  business_internet: z.string().optional(),
  business_mailing_address: z.string().optional(),
  company_name: z.string().optional(),
  business_start_date: z.string().optional(),
  branch_addresses: z.string().optional(),
  main_business_checkbox: z.boolean().optional(),
  main_business_address: z.string().optional(),
  branch_checkbox: z.boolean().optional(),
  trades_line1: z.string().optional(),
  trades_line2: z.string().optional(),
  trades_line3: z.string().optional(),
  other_activities_line1: z.string().optional(),
  other_activities_line2: z.string().optional(),
  manager_name: z.string().optional(),
  manager_nationality: z.string().optional(),
  manager_street: z.string().optional(),
  manager_postcode_city: z.string().optional(),
  manager_birth_date: z.string().optional(),
  manager_birth_place: z.string().optional(),
  manager_phone: z.string().optional(),
  manager_mobile: z.string().optional(),
  manager_email: z.string().optional(),
  manager_internet: z.string().optional(),
  exam_date: z.string().optional(),
  exam_location: z.string().optional(),
  exam_trade: z.string().optional(),
  training_authorization_yes_checkbox: z.boolean().optional(),
  training_authorization_no_checkbox: z.boolean().optional(),
  training_authorization_additional_info: z.string().optional(),
  previous_business_details_line1: z.string().optional(),
  previous_business_yes_checkbox: z.boolean().optional(),
  previous_business_details_line2: z.string().optional(),
  previous_business_no_checkbox: z.boolean().optional(),
  application_place_date: z.string().optional(),
});

export type AntragFormFields = z.infer<typeof AntragFormFieldsSchema>;

const HwkFormAddressSchema = z.object({
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  addressExtra: z.string().nullable(),
});

const HwkFormPersonSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  birthDate: z.string().nullable(),
  birthPlace: z.string().nullable(),
  nationality: z.string().nullable(),
  gender: z.enum(['männlich', 'weiblich']).nullable(),
  address: HwkFormAddressSchema,
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  email: z.string().nullable(),
  internet: z.string().nullable(),
  // person a) on the HWK form may be a company instead of a natural person
  // (KAPG, when the first Anteilseigner is a Firma). These describe that case
  // and are absent/false for a natural person — the common case, and always so
  // for the technical manager.
  isCompany: z.boolean().optional(),
  companyName: z.string().nullable().optional(),
});

const HwkFormQualificationSchema = z.object({
  examDate: z.string().nullable(),
  examPlace: z.string().nullable(),
  trade: z.string().nullable(),
  trainingPermit: z.boolean().nullable(),
});

const HwkFormPriorBusinessSchema = z.object({
  hasPrior: z.boolean().nullable(),
  details: z.string().nullable(),
});

const HwkFormShareholderSchema = z.object({
  isCompany: z.boolean(),
  companyName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  birthDate: z.string().nullable(),
  birthPlace: z.string().nullable(),
  nationality: z.string().nullable(),
  gender: z.enum(['männlich', 'weiblich']).nullable(),
  address: HwkFormAddressSchema,
});
export type HwkFormShareholder = z.infer<typeof HwkFormShareholderSchema>;

const HwkFormBusinessLocationSchema = z.object({
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  addressExtra: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  fax: z.string().nullable(),
  email: z.string().nullable(),
  internet: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  locationType: z.string().nullable(),
  mainOfficeAddress: z.string().nullable(),
});

export const HwkFormDataSchema = z.object({
  entryType: z.string().nullable(),
  tradeDescription: z.string().nullable(),
  qualification: HwkFormQualificationSchema,
  priorBusiness: HwkFormPriorBusinessSchema,
  owner: HwkFormPersonSchema,
  legalForm: z.string().nullable(),
  handelsregister: z.object({
    registered: z.boolean().nullable(),
    companyName: z.string().nullable(),
  }),
  business: z.object({
    name: z.string().nullable(),
    startDate: z.string().nullable(),
    establishmentType: z.string().nullable(),
    relocationFrom: z.string().nullable(),
    takeoverFrom: z.string().nullable(),
  }),
  businessLocation: HwkFormBusinessLocationSchema,
  technicalManager: HwkFormPersonSchema,
  // Anteilseigner / Gesellschafter beyond the owner (person a). The first entry
  // is rendered into the PDF's person b) slot, any further entries go onto a
  // generated extra page. Empty/absent for legal forms without co-owners.
  additionalShareholders: z.array(HwkFormShareholderSchema).optional(),
});
export type HwkFormData = z.infer<typeof HwkFormDataSchema>;

const HWK_MAIL_STATUSES = [
  'not_applicable',
  'pending',
  'sending',
  'failed',
  'sent',
] as const;

export const HwkMailStatusSchema = hwkMailLogSchema
  .pick({
    attemptCount: true,
    lastError: true,
    nextAttemptAt: true,
    sentAt: true,
  })
  .extend({
    status: z.enum(HWK_MAIL_STATUSES),
  });
export type HwkMailStatus = z.infer<typeof HwkMailStatusSchema>;

export const SupportMailInput = z.object({
  body: z.string().min(1),
  contentType: z.enum(['text', 'html']),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        base64: z.string().min(1),
      })
    )
    .optional(),
});

export type SupportMailInput = z.infer<typeof SupportMailInput>;

export const GenericMailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type GenericMailOutputSchema = z.infer<typeof GenericMailOutputSchema>;

export const ProjectWithDocs = projectSchema.merge(
  z.object({
    stEr: z.union([ProjectDocumentMetadataSchema, z.null()]),
    gewA: z.union([ProjectDocumentMetadataSchema, z.null()]),
    hwkDocuments: z.array(HwkProjectDocumentMetadataSchema),
  })
);
export type ProjectWithDocs = z.infer<typeof ProjectWithDocs>;

export const JurisdictionSchema = z.union([
  z.literal('eun'),
  z.literal('kapg'),
  z.literal('all'),
]);

export type JurisdictionSchema = z.infer<typeof JurisdictionSchema>;

export const JurisdictionArraySchema = JurisdictionSchema.array();
export type JurisdictionArraySchema = z.infer<typeof JurisdictionArraySchema>;

export const FinanzaemterSchema = z.array(
  z.object({
    name: z.string(),
    bufaNr: z.number(),
    jurisdiction: JurisdictionArraySchema,
  })
);
export type FinanzaemterSchema = z.infer<typeof FinanzaemterSchema>;

export const CHECKLIST_DOCUMENTS = {
  GS_CONTRACT: 'Gesellschaftsvertrag.pdf',
  SH_CONTRACT: 'Vertrag_zwischen_Gesellschaft_und_Gesellschafter.pdf',
  HR_EXTRACT: 'Handelsregisterauszug.pdf',
};

