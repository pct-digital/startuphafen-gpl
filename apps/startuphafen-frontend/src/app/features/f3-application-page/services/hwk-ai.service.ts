import { Injectable, inject } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import {
  HwkAiResult,
  HWK_AI_ANSWER_KEY,
  parseStoredHwkAiResultValue,
} from '@startuphafen/startuphafen-common';

export const HWK_AI_DESCRIPTION_KEY = 'HwkAiDescription';

export type HwkAiShortDescriptionTarget = {
  key: string;
  componentId: string;
  xmlKey: string;
  questionText: string;
};

const HWK_AI_QUESTION_TEXT = 'KI-Pruefung Handwerk';
export const HWK_AI_DESCRIPTION_QUESTION_TEXT = 'KI-Pruefung Beschreibung';
const HWK_AI_COMPONENT_ID = HWK_AI_ANSWER_KEY;

@Injectable({
  providedIn: 'root',
})
export class HwkAiService {
  private trpc = inject(TrpcService);

  async analyze(description: string, projectId: number): Promise<HwkAiResult> {
    return this.trpc.client.HwkAi.analyze.mutate({
      description,
      projectId,
    });
  }

  parseStoredResult(value: unknown): HwkAiResult | null {
    return parseStoredHwkAiResultValue(value);
  }

  private async upsertAnswer(
    projectId: number,
    key: string,
    payload: {
      value: string;
      stringValue: string | null;
      componentId: string;
      xmlKey: string;
      type: string;
      questionText: string;
      answerText: string;
      headerText: string | null;
    }
  ): Promise<void> {
    const existing = await this.trpc.client.Answers.readFiltered.query({
      projectId,
      key,
    });

    if (existing.length === 0) {
      await this.trpc.client.Answers.create.mutate({
        key,
        projectId,
        ...payload,
      });
      return;
    }

    await this.trpc.client.Answers.update.mutate({
      id: existing[0].id,
      updates: payload,
    });
  }

  async upsertResult(
    projectId: number,
    componentId: string,
    result: HwkAiResult
  ): Promise<void> {
    const payload = {
      value: JSON.stringify(result),
      stringValue: result.classification,
      componentId,
      xmlKey: '/',
      type: 'string',
      questionText: HWK_AI_QUESTION_TEXT,
      answerText: result.classification,
      headerText: null,
    };

    await this.upsertAnswer(projectId, HWK_AI_ANSWER_KEY, payload);
  }

  async upsertDescription(
    projectId: number,
    description: string
  ): Promise<void> {
    const payload = {
      value: description,
      stringValue: null,
      componentId: HWK_AI_COMPONENT_ID,
      xmlKey: '/',
      type: 'string',
      questionText: HWK_AI_DESCRIPTION_QUESTION_TEXT,
      answerText: description,
      headerText: null,
    };

    await this.upsertAnswer(projectId, HWK_AI_DESCRIPTION_KEY, payload);
  }

  async upsertShortDescription(
    projectId: number,
    description: string,
    target: HwkAiShortDescriptionTarget
  ): Promise<void> {
    const payload = {
      value: description,
      stringValue: null,
      componentId: target.componentId,
      xmlKey: target.xmlKey,
      type: 'string',
      questionText: target.questionText,
      answerText: description,
      headerText: null,
    };

    await this.upsertAnswer(projectId, target.key, payload);
  }

  async deleteAnswerByKey(projectId: number, key: string): Promise<void> {
    const existing = await this.trpc.client.Answers.readFiltered.query({
      projectId,
      key,
    });

    for (const answer of existing) {
      await this.trpc.client.Answers.delete.mutate(answer.id);
    }
  }
}
