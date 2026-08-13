import { FormlyFieldConfig, FormlyFieldProps } from '@ngx-formly/core';
import {
  AnswerObject,
  HWK_AI_BRANCHES,
  HwkAiClassification,
  HwkAiResult,
  parseStoredHwkAiResultValue,
} from '@startuphafen/startuphafen-common';

export type QuestionAnswerValues = {
  __catalogueId?: string;
} & Record<string, AnswerObject[string]['value']>;

export const HWK_AI_AUTOFILLED_NOTICE =
  'Diese Frage wurde automatisiert vorausgefüllt. Bitte prüfe die Angaben sorgfältig.';

export const HWK_AI_AUTOFILL_SNAPSHOT_KEY = 'HwkAiAutofillSnapshot';

const parseHwkAiAutofillSnapshot = (
  rawValue: AnswerObject[string]['value']
): Record<string, string> => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return {};
  }
  const snapshot: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      snapshot[key] = value;
    }
  }
  return snapshot;
};

/**
 * True only when `key` currently holds the exact value the KI auto-filled
 * (recorded in the autofill snapshot). A manual selection — even one that
 * happens to match the KI suggestion — returns false, so the "auto-filled"
 * notice is not shown for user-made choices.
 */
export const isHwkAiAutofilledValue = (
  model: Record<string, AnswerObject[string]['value']>,
  key: string
): boolean => {
  const snapshot = parseHwkAiAutofillSnapshot(
    model[HWK_AI_AUTOFILL_SNAPSHOT_KEY]
  );
  const autofilledValue = snapshot[key];
  if (autofilledValue == null) {
    return false;
  }
  return model[key] === autofilledValue;
};

export const HWK_BRANCH_QUESTION_LABEL =
  'In welcher Branche wirst Du mit Deinem Startup tätig sein?';
export const HWK_ENTRY_TYPE_QUESTION_LABEL = 'Eintragung beantragen in:';
export const HWK_TRADE_QUESTION_LABEL =
  'Für welches Handwerk oder handwerksähnliche Gewerbe beantragst Du die Eintragung?';
export const HWK_REFERENCE_LINKS = [
  {
    href: 'https://www.zdh.de/daten-und-fakten/handwerksordnung/gewerbe-der-handwerksordnung-anlage-a/',
    label: 'zulassungspflichtiger Handwerke',
  },
  {
    href: 'https://www.zdh.de/daten-und-fakten/handwerksordnung/gewerbe-anlage-b1-und-b2/',
    label: 'zulassungsfreier Handwerke und handwerksähnlicher Gewerbe',
  },
];

export const HWK_BRANCH_OPTIONS = [
  {
    value: 'us1Ans-1',
    label: HWK_AI_BRANCHES[0],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[0],
  },
  {
    value: 'us1Ans-2',
    label: HWK_AI_BRANCHES[1],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[1],
  },
  {
    value: 'us1Ans-3',
    label: HWK_AI_BRANCHES[2],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[2],
  },
  {
    value: 'us1Ans-4',
    label: HWK_AI_BRANCHES[3],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[3],
  },
  {
    value: 'us1Ans-5',
    label: HWK_AI_BRANCHES[4],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[4],
  },
  {
    value: 'us1Ans-6',
    label: HWK_AI_BRANCHES[5],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[5],
  },
  {
    value: 'us1Ans-7',
    label: HWK_AI_BRANCHES[6],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[6],
  },
  {
    value: 'us1Ans-8',
    label: HWK_AI_BRANCHES[7],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[7],
  },
  {
    value: 'us1Ans-9',
    label: HWK_AI_BRANCHES[8],
    xmlKey: '/',
    stringValue: HWK_AI_BRANCHES[8],
  },
];

export const HWK_ENTRY_TYPE_OPTIONS = [
  {
    value: 'hwkEntryAns-1',
    label: 'Handwerksrolle',
    stringValue: 'Handwerksrolle',
    xmlKey: '/',
  },
  {
    value: 'hwkEntryAns-2',
    label: 'Verzeichnis der zulassungsfreien Handwerksbetriebe',
    stringValue: 'Verzeichnis der zulassungsfreien Handwerksbetriebe',
    xmlKey: '/',
  },
  {
    value: 'hwkEntryAns-3',
    label: 'Verzeichnis der handwerksähnlichen Gewerbebetriebe',
    stringValue: 'Verzeichnis der handwerksähnlichen Gewerbebetriebe',
    xmlKey: '/',
  },
];

const HWK_AI_BRANCH_TO_VALUE: Record<(typeof HWK_AI_BRANCHES)[number], string> =
  {
    [HWK_AI_BRANCHES[0]]: HWK_BRANCH_OPTIONS[0].value,
    [HWK_AI_BRANCHES[1]]: HWK_BRANCH_OPTIONS[1].value,
    [HWK_AI_BRANCHES[2]]: HWK_BRANCH_OPTIONS[2].value,
    [HWK_AI_BRANCHES[3]]: HWK_BRANCH_OPTIONS[3].value,
    [HWK_AI_BRANCHES[4]]: HWK_BRANCH_OPTIONS[4].value,
    [HWK_AI_BRANCHES[5]]: HWK_BRANCH_OPTIONS[5].value,
    [HWK_AI_BRANCHES[6]]: HWK_BRANCH_OPTIONS[6].value,
    [HWK_AI_BRANCHES[7]]: HWK_BRANCH_OPTIONS[7].value,
    [HWK_AI_BRANCHES[8]]: HWK_BRANCH_OPTIONS[8].value,
  };

const HWK_AI_CLASSIFICATION_TO_ENTRY_VALUE: Partial<
  Record<HwkAiClassification, (typeof HWK_ENTRY_TYPE_OPTIONS)[number]['value']>
> = {
  Handwerksrolle: HWK_ENTRY_TYPE_OPTIONS[0].value,
  'zulassungsfreien Handwerksbetriebe': HWK_ENTRY_TYPE_OPTIONS[1].value,
  'handwerksähnlichen Gewerbebetriebe': HWK_ENTRY_TYPE_OPTIONS[2].value,
};

const isAnswerEntry = (value: unknown): value is AnswerObject[string] =>
  typeof value === 'object' &&
  value !== null &&
  'value' in value &&
  'type' in value &&
  'xmlKey' in value &&
  'componentId' in value &&
  'questionText' in value &&
  'answerText' in value &&
  'headerText' in value &&
  'stringValue' in value;

export const toQuestionAnswerValues = (
  answers: AnswerObject | QuestionAnswerValues
): QuestionAnswerValues => {
  const normalizedAnswers: QuestionAnswerValues = {};

  for (const [key, value] of Object.entries(answers)) {
    if (key === '__catalogueId' && typeof value === 'string') {
      normalizedAnswers.__catalogueId = value;
      continue;
    }
    normalizedAnswers[key] = isAnswerEntry(value) ? value.value : value;
  }

  return normalizedAnswers;
};

export const isHwkFlowAllowed = (answers: QuestionAnswerValues): boolean => {
  const hasExistingHwkEntry = answers['Gw29'] === 'gw29Ans-1';
  const catalogueId = answers['__catalogueId'];
  if (catalogueId === 'eun') {
    return answers['Us1'] === 'us1Ans-2' && !hasExistingHwkEntry;
  }
  if (catalogueId === 'kapg') {
    return answers['HwkBranche'] === 'us1Ans-2' && !hasExistingHwkEntry;
  }
  return false;
};

export const isHwkBrancheAllowed = (answers: QuestionAnswerValues): boolean =>
  answers['__catalogueId'] === 'kapg';

export const parseStoredHwkAiResult = (value: unknown): HwkAiResult | null => {
  return parseStoredHwkAiResultValue(value);
};

export const getHwkAiSuggestedBranchValue = (
  result: HwkAiResult
): string | null => {
  if (result.branch === null) {
    return null;
  }

  return HWK_AI_BRANCH_TO_VALUE[result.branch];
};

export const getHwkAiSuggestedEntryTypeValue = (
  result: HwkAiResult
): string | null => {
  const entryType = HWK_AI_CLASSIFICATION_TO_ENTRY_VALUE[result.classification];
  return entryType ?? null;
};

export const getHwkAiSuggestedTradeValue = (
  result: HwkAiResult
): string | null => {
  const normalizedTrades = result.trades
    .map((trade) => trade.trim())
    .filter((trade) => trade.length > 0);
  if (normalizedTrades.length === 0) {
    return null;
  }
  return normalizedTrades.join('\n');
};

export const getHwkAiSuggestedShortDescription = (
  result: HwkAiResult,
  maxLength: number
): string | null => {
  // Apply the improved Tätigkeitsbeschreibung for every real classification —
  // Handwerk and non-Handwerk alike. Only the fallback result (branch === null,
  // i.e. the KI could not classify) is skipped, so we never push the generic
  // placeholder text onto the official Gewerbeanmeldung field.
  if (result.branch === null) {
    return null;
  }

  const trimmed = result.shortDescription.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

export const buildHwkAnswerObject = (
  model: Record<string, AnswerObject[string]['value']>,
  fields: FormlyFieldConfig<
    FormlyFieldProps & {
      [additionalProperties: string]: any;
    }
  >[],
  componentID: string
): AnswerObject => {
  const answerObject: AnswerObject = {};

  for (const answerKey of Object.keys(model)) {
    const selectedField = fields.find((e) => e.key === answerKey);
    if (!selectedField) {
      continue;
    }

    let xmlKey = '/';
    let stringValue = null;
    let properQuestion = '';

    if (selectedField?.type === 'checkbox') {
      properQuestion = selectedField?.props?.['textSplitOne'] ?? '';
    } else if (selectedField?.props?.['label']) {
      properQuestion = selectedField.props['label'];
    } else if (selectedField?.props?.['secondaryLabel']) {
      properQuestion = selectedField.props['secondaryLabel'];
    }

    let properAnswer = '';
    let headerText: string | null = null;
    if (fields[0]?.type === 'empty') {
      headerText = fields[0].props?.['label'] ?? null;
    }
    const type = selectedField.type?.toString() ?? 'string';

    if (selectedField?.type === 'multi-single') {
      const options = selectedField.props?.['options'];
      const selectedOption = Array.isArray(options)
        ? options.find(
            (opt: { value: string }) => opt.value === model[answerKey]
          )
        : undefined;

      xmlKey = selectedOption?.['xmlKey'];
      stringValue = selectedOption?.['stringValue'];
      properAnswer = selectedOption?.label ?? '';
    } else {
      xmlKey = selectedField?.props?.['xmlKey'] ?? '/';
      stringValue = selectedField?.props?.['stringValue'] ?? null;
      if (typeof model[answerKey] === 'boolean') {
        properAnswer = model[answerKey] ? 'Ja' : 'Nein';
      } else {
        const answerValue = model[answerKey];
        properAnswer = answerValue != null ? answerValue.toString() : '';
      }
    }

    answerObject[answerKey] = {
      value: model[answerKey],
      xmlKey,
      stringValue,
      type,
      componentId: componentID,
      questionText: properQuestion,
      answerText: properAnswer,
      headerText,
    };
  }

  return answerObject;
};
