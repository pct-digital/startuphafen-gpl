import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FormlyFieldConfig } from '@ngx-formly/core';
import {
  FormlyWrapperHeading,
  PctLoaderService,
} from '@startuphafen/angular-common';
import {
  AnswerObject,
  HWK_AI_ANSWER_KEY,
  HwkAiResult,
} from '@startuphafen/startuphafen-common';
import {
  HWK_AI_DESCRIPTION_KEY,
  HWK_AI_DESCRIPTION_QUESTION_TEXT,
  HwkAiService,
  HwkAiShortDescriptionTarget,
} from '../../../services/hwk-ai.service';
import {
  getHwkAiSuggestedBranchValue,
  getHwkAiSuggestedEntryTypeValue,
  getHwkAiSuggestedShortDescription,
  getHwkAiSuggestedTradeValue,
  HWK_AI_AUTOFILL_SNAPSHOT_KEY,
  HWK_BRANCH_QUESTION_LABEL,
  HWK_ENTRY_TYPE_OPTIONS,
  HWK_ENTRY_TYPE_QUESTION_LABEL,
  HWK_TRADE_QUESTION_LABEL,
} from '../../hwk/hwk-utils';
import { KiPruefungPresentationComponent } from './ki-pruefung-presentation.component';

const DESCRIPTION_LABEL = 'Beschreibung Deiner neuen Tätigkeit';
const HWK_AI_QUESTION_TEXT = 'KI-Pruefung Handwerk';
const HWK_AI_AUTOFILL_SNAPSHOT_QUESTION_TEXT = 'KI-Pruefung Autofill Snapshot';
const MAX_SUGGESTION_LENGTH = 300;
// Shown when the KI ran but could not assign a Branche (fallback / unclear
// classification), so the user knows nothing was auto-filled and to continue
// manually — instead of the previous silent no-op.
const HWK_AI_NO_CLASSIFICATION_NOTICE =
  'Die KI konnte keine eindeutige Zuordnung treffen. Bitte wähle die Branche aus und ergänze die Angaben manuell.';

const SHORT_DESCRIPTION_TARGETS: Record<
  string,
  HwkAiShortDescriptionTarget & { maxLength?: number }
> = {
  eun: {
    key: 'St25',
    componentId: 'St25',
    xmlKey: 'ArtTaet/GewerbeArt',
    questionText: DESCRIPTION_LABEL,
    maxLength: 200,
  },
  kapg: {
    key: 'St15',
    componentId: 'St15',
    xmlKey: 'AllgAngaben/ArtTaet/GewerbeArt',
    questionText: DESCRIPTION_LABEL,
    maxLength: MAX_SUGGESTION_LENGTH,
  },
};

type HwkAiMultiSingleSuggestion = {
  value: string;
  answerText: string;
  stringValue: string | null;
};

const BRANCH_ANSWER_TARGETS: Record<
  string,
  { key: string; componentId: string; questionText: string }
> = {
  eun: {
    key: 'Us1',
    componentId: 'Us1',
    questionText: HWK_BRANCH_QUESTION_LABEL,
  },
  kapg: {
    key: 'HwkBranche',
    componentId: 'HwkBranche',
    questionText: HWK_BRANCH_QUESTION_LABEL,
  },
};

type QuestionAnswerValues = {
  __catalogueId?: string;
} & Record<string, AnswerObject[string]['value']>;

type HwkAiAutofillSnapshot = Record<string, string>;

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

const toQuestionAnswerValues = (
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

@Component({
  selector: 'sh-ki-pruefung-container',
  standalone: true,
  imports: [KiPruefungPresentationComponent],
  templateUrl: './ki-pruefung.component.html',
})
export class KiPruefungContainerComponent implements OnInit {
  private hwkAiService = inject(HwkAiService);
  private route = inject(ActivatedRoute);
  private loaderService = inject(PctLoaderService);

  @Input() answers: AnswerObject | QuestionAnswerValues = {};
  @Output() answersUpdated = new EventEmitter<AnswerObject>();
  @Output() answersRemoved = new EventEmitter<string[]>();
  // Emits while the KI evaluation runs, so the surrounding step can lock the
  // Branche selection and the "Weiter" navigation until it finishes/fails.
  @Output() loadingChange = new EventEmitter<boolean>();

  form = new FormGroup({});
  model: Record<string, AnswerObject[string]['value']> = {};
  formModel: Record<string, AnswerObject[string]['value']> = {};
  fields: FormlyFieldConfig[] = [];
  hwkAiResult: HwkAiResult | null = null;
  hwkAiError: string | null = null;
  hwkAiLoading = false;

  ngOnInit() {
    this.model = toQuestionAnswerValues(this.answers);

    this.fields = [
      {
        key: 'description',
        type: 'textarea',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: DESCRIPTION_LABEL,
          placeholder:
            'Beschreibe Deine Tätigkeit gern ausführlich, genau und präzise.',
          tooltip:
            'Je ausführlicher und genauer Deine Beschreibung, desto besser kann die KI einschätzen.',
          required: false,
          rows: 10,
          onBlur: () => this.persistDescriptionOnBlur(),
        },
      },
    ];

    const storedResult = this.hwkAiService.parseStoredResult(
      this.getStoredAnswerValue(HWK_AI_ANSWER_KEY)
    );
    if (storedResult) {
      this.hwkAiResult = storedResult;
    }

    const storedDescription = this.getStoredDescription();
    if (storedDescription) {
      this.formModel['description'] = storedDescription;
    }
  }

  async runHwkAi() {
    this.hwkAiError = null;
    const description = this.getDescriptionValue();
    if (!description) {
      this.hwkAiError = 'Bitte gib eine Beschreibung ein.';
      return;
    }

    const projectId = this.getProjectId();
    if (!projectId) {
      this.hwkAiError = 'Projekt konnte nicht geladen werden.';
      return;
    }

    this.syncDescriptionAnswer();
    this.hwkAiLoading = true;
    this.loadingChange.emit(true);
    try {
      const result = await this.loaderService.doWhileLoading(
        'KiPruefungContainerComponent.runHwkAi',
        async () => await this.hwkAiService.analyze(description, projectId)
      );
      this.hwkAiResult = result;
      const resultAnswer = this.buildResultAnswer(result);
      this.mergeLocalAnswers(resultAnswer);
      this.answersUpdated.emit(resultAnswer);
      this.persistHwkAiSuggestions(result);
    } catch (error) {
      console.error('Failed to run HWK AI', error);
      this.hwkAiError =
        'Die KI-Auswertung konnte nicht geladen werden. Bitte versuche es erneut.';
    } finally {
      this.hwkAiLoading = false;
      this.loadingChange.emit(false);
    }
  }

  canRunHwkAi(): boolean {
    return this.getDescriptionValue().length > 0 && !this.hwkAiLoading;
  }

  get hwkAiNotice(): string | null {
    if (!this.hwkAiResult) {
      return null;
    }
    // branch === null means the KI could not confidently classify the
    // activity (fallback result) — nothing was auto-filled.
    return this.hwkAiResult.branch === null
      ? HWK_AI_NO_CLASSIFICATION_NOTICE
      : null;
  }

  private getDescriptionValue(): string {
    const value = this.formModel['description'];
    return typeof value === 'string' ? value.trim() : '';
  }

  private getShortDescriptionTarget():
    | (HwkAiShortDescriptionTarget & { maxLength?: number })
    | null {
    const catalogueId = this.getCatalogueId();
    return SHORT_DESCRIPTION_TARGETS[catalogueId] ?? null;
  }

  private getBranchAnswerTarget(): {
    key: string;
    componentId: string;
    questionText: string;
  } | null {
    const catalogueId = this.getCatalogueId();
    return BRANCH_ANSWER_TARGETS[catalogueId] ?? null;
  }

  private getEntryTypeSuggestion(
    result: HwkAiResult
  ): HwkAiMultiSingleSuggestion | null {
    const suggestedValue = getHwkAiSuggestedEntryTypeValue(result);
    if (!suggestedValue) {
      return null;
    }

    const selectedOption = HWK_ENTRY_TYPE_OPTIONS.find(
      (option) => option.value === suggestedValue
    );
    if (!selectedOption) {
      return null;
    }

    return {
      value: selectedOption.value,
      answerText: selectedOption.label,
      stringValue: selectedOption.stringValue,
    };
  }

  private buildShortDescriptionAnswer(
    description: string,
    target: HwkAiShortDescriptionTarget
  ): AnswerObject {
    return {
      [target.key]: {
        value: description,
        xmlKey: target.xmlKey,
        type: 'string',
        componentId: target.componentId,
        stringValue: null,
        questionText: target.questionText,
        answerText: description,
        headerText: null,
      },
    };
  }

  private buildResultAnswer(result: HwkAiResult): AnswerObject {
    return {
      [HWK_AI_ANSWER_KEY]: {
        value: JSON.stringify(result),
        xmlKey: '/',
        type: 'string',
        componentId: HWK_AI_ANSWER_KEY,
        stringValue: result.classification,
        questionText: HWK_AI_QUESTION_TEXT,
        answerText: result.classification,
        headerText: null,
      },
    };
  }

  private buildMultiSingleAnswer(
    key: string,
    componentId: string,
    questionText: string,
    suggestion: HwkAiMultiSingleSuggestion
  ): AnswerObject {
    return {
      [key]: {
        value: suggestion.value,
        xmlKey: '/',
        type: 'multi-single',
        componentId,
        stringValue: suggestion.stringValue,
        questionText,
        answerText: suggestion.answerText,
        headerText: null,
      },
    };
  }

  private buildStringAnswer(
    key: string,
    componentId: string,
    questionText: string,
    answerText: string,
    xmlKey = '/'
  ): AnswerObject {
    return {
      [key]: {
        value: answerText,
        xmlKey,
        type: 'string',
        componentId,
        stringValue: null,
        questionText,
        answerText,
        headerText: null,
      },
    };
  }

  private persistHwkAiSuggestions(result: HwkAiResult): void {
    const suggestionAnswers: AnswerObject = {};
    const previousSnapshot = this.getAutofillSnapshot();
    const branchValue = getHwkAiSuggestedBranchValue(result);
    const isHandwerkBranch = branchValue === 'us1Ans-2';
    const hasExistingHwkEntry =
      this.getStoredAnswerValue('Gw29') === 'gw29Ans-1';

    const target = this.getShortDescriptionTarget();
    if (target) {
      const shortDescription = getHwkAiSuggestedShortDescription(
        result,
        target.maxLength ?? MAX_SUGGESTION_LENGTH
      );
      if (
        shortDescription &&
        !this.hasStoredAnswerWithValueAndXmlKey(
          target.key,
          shortDescription,
          target.xmlKey
        )
      ) {
        Object.assign(
          suggestionAnswers,
          this.buildShortDescriptionAnswer(shortDescription, target)
        );
      }
    }

    const branchTarget = this.getBranchAnswerTarget();
    if (branchTarget && branchValue !== null) {
      // An explicit KI run takes precedence: apply the suggested Branche even
      // when the user had picked one manually (overwrite), only skipping the
      // no-op case where it already matches.
      if (this.getStoredAnswerValue(branchTarget.key) !== branchValue) {
        Object.assign(
          suggestionAnswers,
          this.buildMultiSingleAnswer(
            branchTarget.key,
            branchTarget.componentId,
            branchTarget.questionText,
            {
              value: branchValue,
              answerText: result.branch ?? '',
              stringValue: null,
            }
          )
        );
      }
    }

    if (isHandwerkBranch && !hasExistingHwkEntry) {
      const entryTypeSuggestion = this.getEntryTypeSuggestion(result);
      if (
        entryTypeSuggestion &&
        this.getStoredAnswerValue('HwkEntryType') !== entryTypeSuggestion.value
      ) {
        Object.assign(
          suggestionAnswers,
          this.buildMultiSingleAnswer(
            'HwkEntryType',
            'HwkEntryType',
            HWK_ENTRY_TYPE_QUESTION_LABEL,
            entryTypeSuggestion
          )
        );
      }

      const tradeSuggestion = getHwkAiSuggestedTradeValue(result);
      if (
        tradeSuggestion &&
        this.getStoredAnswerValue('HwkTrade')?.trim() !== tradeSuggestion
      ) {
        Object.assign(
          suggestionAnswers,
          this.buildStringAnswer(
            'HwkTrade',
            'HwkTrade',
            HWK_TRADE_QUESTION_LABEL,
            tradeSuggestion
          )
        );
      }
    }

    if (Object.keys(suggestionAnswers).length === 0) {
      return;
    }

    const autofillSnapshot = this.buildAutofillSnapshot(
      suggestionAnswers,
      previousSnapshot
    );
    const answersWithSnapshot = {
      ...suggestionAnswers,
      ...this.buildAutofillSnapshotAnswer(autofillSnapshot),
    };

    this.mergeLocalAnswers(answersWithSnapshot);
    this.answersUpdated.emit(answersWithSnapshot);
  }

  private buildDescriptionAnswer(description: string): AnswerObject {
    return {
      [HWK_AI_DESCRIPTION_KEY]: {
        value: description,
        xmlKey: '/',
        type: 'string',
        componentId: HWK_AI_ANSWER_KEY,
        stringValue: null,
        questionText: HWK_AI_DESCRIPTION_QUESTION_TEXT,
        answerText: description,
        headerText: null,
      },
    };
  }

  private buildAutofillSnapshotAnswer(
    snapshot: HwkAiAutofillSnapshot
  ): AnswerObject {
    return {
      [HWK_AI_AUTOFILL_SNAPSHOT_KEY]: {
        value: JSON.stringify(snapshot),
        xmlKey: '/',
        type: 'string',
        componentId: HWK_AI_ANSWER_KEY,
        stringValue: null,
        questionText: HWK_AI_AUTOFILL_SNAPSHOT_QUESTION_TEXT,
        answerText: JSON.stringify(snapshot),
        headerText: null,
      },
    };
  }

  private buildAutofillSnapshot(
    suggestionAnswers: AnswerObject,
    previousSnapshot: HwkAiAutofillSnapshot
  ): HwkAiAutofillSnapshot {
    const snapshot: HwkAiAutofillSnapshot = {};

    for (const [key, expectedValue] of Object.entries(previousSnapshot)) {
      if (this.getStoredAnswerValue(key) === expectedValue) {
        snapshot[key] = expectedValue;
      }
    }

    for (const [key, answer] of Object.entries(suggestionAnswers)) {
      const storedValue = this.extractStoredAnswerValue(answer.value);
      if (storedValue == null) {
        continue;
      }
      const trimmed = storedValue.trim();
      if (trimmed.length === 0) {
        continue;
      }
      snapshot[key] = trimmed;
    }

    return snapshot;
  }

  private getAutofillSnapshot(): HwkAiAutofillSnapshot {
    const snapshotRawValue = this.getStoredAnswerValue(
      HWK_AI_AUTOFILL_SNAPSHOT_KEY
    );
    if (snapshotRawValue == null) {
      return {};
    }

    let parsedSnapshot: unknown;
    try {
      parsedSnapshot = JSON.parse(snapshotRawValue);
    } catch {
      return {};
    }

    if (typeof parsedSnapshot !== 'object' || parsedSnapshot == null) {
      return {};
    }

    const snapshot: HwkAiAutofillSnapshot = {};
    for (const [key, value] of Object.entries(parsedSnapshot)) {
      if (typeof value !== 'string') {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      snapshot[key] = trimmed;
    }
    return snapshot;
  }

  private persistDescriptionOnBlur() {
    this.syncDescriptionAnswer();
  }

  private getCatalogueId(): string {
    return this.route.snapshot.paramMap.get('catalogueId') ?? '';
  }

  private getProjectId(): number | null {
    const projectId = Number(this.route.snapshot.paramMap.get('projectId'));
    return Number.isNaN(projectId) || !projectId ? null : projectId;
  }

  private syncDescriptionAnswer(): void {
    const description = this.getDescriptionValue();
    const currentDescription = this.getStoredAnswerValue(
      HWK_AI_DESCRIPTION_KEY
    );

    if (!description) {
      if (currentDescription == null) {
        return;
      }
      this.removeLocalAnswer(HWK_AI_DESCRIPTION_KEY);
      this.answersRemoved.emit([HWK_AI_DESCRIPTION_KEY]);
      return;
    }

    if (currentDescription === description) {
      return;
    }

    const descriptionAnswer = this.buildDescriptionAnswer(description);
    this.mergeLocalAnswers(descriptionAnswer);
    this.answersUpdated.emit(descriptionAnswer);
  }

  private mergeLocalAnswers(answersToMerge: AnswerObject): void {
    this.answers = {
      ...this.answers,
      ...answersToMerge,
    };
  }

  private removeLocalAnswer(key: string): void {
    const answers = { ...this.answers };
    delete answers[key];
    this.answers = answers;
  }

  private getStoredAnswerValue(key: string): string | null {
    const rawAnswer = this.answers[key];
    if (rawAnswer == null) {
      return null;
    }

    const rawValue = isAnswerEntry(rawAnswer) ? rawAnswer.value : rawAnswer;
    const value = this.extractStoredAnswerValue(rawValue);
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private hasStoredAnswerWithValueAndXmlKey(
    key: string,
    expectedValue: string,
    expectedXmlKey: string
  ): boolean {
    const rawAnswer = this.answers[key];
    if (!isAnswerEntry(rawAnswer)) {
      return false;
    }

    const value = this.extractStoredAnswerValue(rawAnswer.value);
    if (value == null) {
      return false;
    }

    return (
      value.trim() === expectedValue && rawAnswer.xmlKey === expectedXmlKey
    );
  }

  private extractStoredAnswerValue(
    value: AnswerObject[string]['value']
  ): string | null {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }
    return null;
  }

  private getStoredDescription(): string {
    return (
      this.getStoredAnswerValue(HWK_AI_DESCRIPTION_KEY) ??
      this.getStoredAnswerValue('St25') ??
      this.getStoredAnswerValue('St15') ??
      ''
    );
  }

}
