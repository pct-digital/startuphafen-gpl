import { z } from 'zod';
import { ShAnswers, ShUser } from '../generated/db-entities';

export const gewaDisabledAnswers = [
  'Freie Berufe',
  'Dienstleistungen',
  'Kultur & Kreativwirtschaft',
];
//used in form template enter values accordingly, should not matter if different form types are worked on
export const fieldsNotRequired = ['Adressergänzung', 'Hausnummerzusatz'];
export const fieldsWithInputLimit = ['SteEr25'];

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
    alternativeText: z.null(),
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
});
export type Contact = z.infer<typeof Contact>;

export const FormData = z.object({
  userId: z.string(),
  formId: z.number(),
  formData: z.any(),
});
export type FormData = z.infer<typeof FormData>;

const baseQuestionFlow = z.object({
  id: z.number(),
  documentId: z.string(),
  flowId: z.string(),
  flowText: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string(),
  endOfFlow: z.boolean(),
});
type baseQuestionFlow = z.infer<typeof baseQuestionFlow>;

export type QuestionFlow = z.infer<typeof baseQuestionFlow> & {
  questionDict?: Question[];
};

const strapiTypeEnums = z.union([
  z.literal('string'),
  z.literal('number'),
  z.literal('bool'),
  z.literal('date'),
  z.literal('multi-single'),
  z.literal('multi-multi'),
  z.literal('number-euro'),
  z.literal('checkbox'),
]);

export const QuestionFlow: z.ZodType<QuestionFlow> = baseQuestionFlow.extend({
  questionDict: z.lazy(() => z.array(Question).optional()),
});

export const Answer = z.object({
  id: z.number(),
  answerText: z.string(),
  xmlKey: z.string(),
  triggersFlag: z.string().nullish().optional(),
  additionalFields: z.array(
    z.object({
      id: z.number(),
      xmlKey: z.string(),
      relQId: z.string(),
      additionalFieldText: z.string(),
      type: strapiTypeEnums,
    })
  ),
  question_flow: QuestionFlow.nullish(),
  additionalQuestionflowLink: z
    .object({
      extraRule: z.string(),
      question_flow: QuestionFlow,
      multipleRequirements: z
        .array(z.object({ relQID: z.string(), expectedValue: z.string() }))
        .nullish()
        .optional(),
    })
    .nullish()
    .optional(),
});
export type Answer = z.infer<typeof Answer>;

export const Question = z.object({
  id: z.number(),
  qId: z.string(),
  questionText: z.string(),
  type: strapiTypeEnums,
  flowRelevant: z.boolean(),
  answerDict: z.array(Answer).optional(),
  showFlag: z.string().nullish().optional(),
  tooltip: z.string().nullish(),
});
export type Question = z.infer<typeof Question>;

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
  getQuestionFlowByFlowId: (flowId: string) => Promise<QuestionFlow>;
  getQuestionFlow: (docId: string) => Promise<QuestionFlow>;
  getWebsiteText: (placeToPutList: string[]) => Promise<WebsiteText[]>;
}

export interface XMLBuilderInterface {
  buildXML: (content: ShAnswers[], user: ShUser) => Promise<any>;
  fillDefaults: (
    objToFill: any,
    content: ShAnswers[],
    user: ShUser
  ) => Promise<any>;
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

export const EricEncryptionParam = z.object({
  version: z.number(),
  certHandle: z.number(),
  pin: z.string(),
});
export type EricEncryptionParam = z.infer<typeof EricEncryptionParam>;

export const EricHandleProcessInput = z.object({
  xmlData: z.string(),
  elsterProcedureVersion: z.string(),
  processFlags: z.array(z.string()),
  ericPrintParam: EricPrintParam,
});
export type EricHandleProcessInput = z.infer<typeof EricHandleProcessInput>;

export enum EricProcessFlags {
  ERIC_VALIDIERE = 'ERIC_VALIDIERE',
  ERIC_SENDE = 'ERIC_SENDE',
  ERIC_DRUCKE = 'ERIC_DRUCKE',
  ERIC_HINWEIS = 'ERIC_HINWEIS',
}

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

export const FormDataInput = z.object({
  'Antragstellende Person': z.object({
    Nachname: z.string(),
    Vorname: z.string(),
    Anrede: z.string(),
    Titel: z.string(),
    Geburtsdatum: z.union([z.date(), z.string()]),
    Staatsangehörigkeit: z.string(),
    Telefonnummer: z.string(),
    EMail: z.string(),
    Adresse: z.object({
      Straße: z.string(),
      Hausnummer: z.string(),
      PLZ: z.string(),
      Ort: z.string(),
    }),
  }),
  Betriebsdaten: z.object({
    Betriebsstätte: z
      .object({
        Straße: z.string(),
        Hausnummer: z.string(),
        PLZ: z.string(),
        Ort: z.string(),
      })
      .optional(),
    'Angemeldete Tätigkeit': z.object({
      Nebenerwerb: z.boolean(),
      Beginn: z.union([z.date(), z.string()]),
      Beschreibung: z.string(),
    }),
    'Vorliegende Erlaubnis': z.object({
      'Erlaubnis liegt vor': z.boolean(),
      'Ausstellende Behörde': z.union([z.string(), z.null()]),
      Ausstellungsdatum: z.union([z.string(), z.null()]),
    }),
    'Vorliegende Handwerkskarte': z.object({
      'Handwerkskarte liegt vor': z.boolean(),
      'Name der Handwerkskammer': z.union([z.string(), z.null()]),
      Ausstellungsdatum: z.union([z.string(), z.null()]),
    }),
  }),
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

export const OZGFormDataRequest = z.object({
  control: OZGControl,
  formData: z.any(),
});
export type OZGFormDataRequest = z.infer<typeof OZGFormDataRequest>;

export const OZGResponse = z.object({
  transactionId: z.string(),
  vorgang: z.object({
    vorgangId: z.string(),
    vorgangNummer: z.string(),
    status: z.string(),
    statusSince: z.string(),
  }),
});
export type OZGResponse = z.infer<typeof OZGResponse>;

export interface OZGInterface {
  postOZGFormData: (
    formData: FormDataNode[],
    attachment?: string
  ) => Promise<OZGResponse>;
}

export const LoginPageTexts = z.object({
  title: z.string().default(''),
  subtitle: z.string().default(''),
  content: z.string().default(''),
  loginButton: z.string().default(''),
  registerButton: z.string().default(''),
});
export type LoginPageTexts = z.infer<typeof LoginPageTexts>;

export const HomePageTexts = z.object({
  title: z.string().default(''),
  subtitle: z.string().default(''),
  content: z.string().default(''),
});
export type HomePageTexts = z.infer<typeof HomePageTexts>;

export const SingleTypeData = z.union([LoginPageTexts, HomePageTexts]);
export type SingleTypeData = z.infer<typeof SingleTypeData>;

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

export const CatalogueQuestion = z.object({
  id: z.union([z.string(), z.number()]),
  documentId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string(),
  questionId: z.string(),
  type: strapiTypeEnums,
  questionText: z.string(),
  answerOptions: z.array(
    z.object({
      id: z.number(),
      answerId: z.string(),
      answerText: z.string(),
      xmlKey: z.string(),
    })
  ),
  validations: z
    .array(
      z.object({
        id: z.number(),
        relativeQuestionId: z.string(),
        relativeAnswerId: z.string(),
        ruleType: z.object({
          operation: z.enum(['eq', 'lt', 'gt', 'oneOf']),
          value: z.string(),
        }),
      })
    )
    .nullish()
    .optional(),
  tooltip: z.string().nullish().optional(),
});
export type CatalogueQuestion = z.infer<typeof CatalogueQuestion>;

export const Catalogue = z.object({
  id: z.number(),
  documentId: z.string(),
  catalogueId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string(),
  questions: z.array(CatalogueQuestion),
});
export type Catalogue = z.infer<typeof Catalogue>;
export const CatalogueAnswer = z.record(
  z.string(),
  z.array(
    z.object({
      aId: z.string(),
      value: z.union([z.string(), z.number()]),
      xmlKey: z.string(),
      type: z.string(),
    })
  )
);

export type CatalogueAnswer = z.infer<typeof CatalogueAnswer>;
