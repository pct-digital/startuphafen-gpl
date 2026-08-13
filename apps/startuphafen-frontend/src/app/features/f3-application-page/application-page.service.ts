import { Injectable } from '@angular/core';
import { FormlyFieldConfig, FormlyFieldProps } from '@ngx-formly/core';
import { TrpcService } from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';

@Injectable({
  providedIn: 'root',
})
export class ApplicationPageService {
  constructor(private trpc: TrpcService) {}

  async getProject(id: number) {
    return (
      await this.trpc.client.Project.readFiltered.query({
        id: id,
      })
    )[0];
  }

  async getAnswers(projectId: number) {
    return this.trpc.client.Answers.readFiltered.query({
      projectId: projectId,
    });
  }

  async updateProgress(id: number, progress: number) {
    if (progress >= 100) {
      await this.trpc.client.Project.markQuestionnaireComplete.mutate(id);
      return;
    }

    await this.trpc.client.Project.update.mutate({
      id: id,
      updates: { progress: progress },
    });
  }

  async getSentVars(projectId: number) {
    if (projectId === -1) return;
    const res = await this.trpc.client.Project.pickFiltered.query({
      pick: ['stSent', 'gwSent'],
      filters: { id: projectId },
    });
    return { stSent: res[0].stSent, gwSent: res[0].gwSent };
  }

  async isGewADisabled(projectId: number) {
    return await this.trpc.client.Project.gewADisabled.query(projectId);
  }

  filterHiddenFields(
    model: Record<string, unknown>,
    fields: FormlyFieldConfig[]
  ): Record<string, unknown> {
    const filteredModel: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(model)) {
      const field = this.findSelectedField(fields, key);

      // Keep the field if it doesn't exist in fields or if it has no hide expression
      if (!field || !field.expressions?.hide) {
        filteredModel[key] = value;
        continue;
      }

      // Set the model context for the hide expression
      const fieldWithModel = { ...field, model };

      // Check if the field is currently hidden
      const hideExpression = field.expressions.hide;
      const isHidden =
        typeof hideExpression === 'function'
          ? hideExpression(fieldWithModel)
          : hideExpression;

      if (!isHidden) {
        filteredModel[key] = value;
      }
    }

    return filteredModel;
  }

  // Inverse of filterHiddenFields: returns the keys of all fields whose `hide`
  // expression currently evaluates truthy. Iterates `fields` (not `model`) so
  // hidden keys are reported even when Formly already stripped their value from
  // the model. Used to clean up answers of a branch that became inactive (e.g.
  // when a shareholder is switched between Firma and Natürliche Person).
  getHiddenFieldKeys(
    model: Record<string, unknown>,
    fields: FormlyFieldConfig[]
  ): string[] {
    const hiddenKeys = new Set<string>();

    const collectHiddenKeys = (fieldList: FormlyFieldConfig[]): void => {
      for (const field of fieldList) {
        if (field.fieldGroup) {
          collectHiddenKeys(field.fieldGroup);
        }

        if (typeof field.key !== 'string' || !field.expressions?.hide) {
          continue;
        }

        const fieldWithModel = { ...field, model };
        const hideExpression = field.expressions.hide;
        const isHidden =
          typeof hideExpression === 'function'
            ? hideExpression(fieldWithModel)
            : hideExpression;

        if (isHidden) {
          hiddenKeys.add(field.key);
        }
      }
    };

    collectHiddenKeys(fields);

    return Array.from(hiddenKeys);
  }

  findSelectedField(
    fields: FormlyFieldConfig<
      FormlyFieldProps & {
        [additionalProperties: string]: any;
      }
    >[],
    answerKey: string
  ):
    | FormlyFieldConfig<
        FormlyFieldProps & {
          [additionalProperties: string]: any;
        }
      >
    | undefined {
    for (const field of fields) {
      if (field.key === answerKey) {
        return field;
      }
      if (field.fieldGroup) {
        const searchResult = this.findSelectedField(
          field.fieldGroup,
          answerKey
        );
        if (searchResult !== undefined) return searchResult;
      }
    }
    return undefined;
  }

  async resetProjectState(projectId: number) {
    const sentStatus = await this.trpc.client.Project.pickFiltered.query({
      filters: { id: projectId },
      pick: ['stSent', 'gwSent'],
    });

    const hwkSentStatus = await this.trpc.client.HwkForm.getHwkMailStatus.query(
      projectId
    );
    if (
      sentStatus[0].stSent ||
      sentStatus[0].gwSent ||
      hwkSentStatus.status === 'sent'
    )
      return;
    //reset QuestionTracking gro Project
    await this.trpc.client.QuestionTracking.deleteForProject.mutate(projectId);
    //reset Project Progress
    await this.trpc.client.Project.update.mutate({
      id: projectId,
      updates: { progress: 1 },
    });
  }

  buildAnswerObject(
    model: Record<string, unknown>,
    fields: FormlyFieldConfig<
      FormlyFieldProps & {
        [additionalProperties: string]: any;
      }
    >[],
    componentID: string
  ) {
    const answerObject: AnswerObject = {};
    for (const answerKey of Object.keys(model)) {
      const selectedField = this.findSelectedField(fields, answerKey);
      // Only process keys that are defined in this component's fields
      if (!selectedField) {
        continue;
      }
      let xmlKey = '/';
      let stringValue = null;

      let properQuestion;
      if (selectedField?.type === 'checkbox') {
        properQuestion = selectedField?.props?.['textSplitOne'] ?? '';
      } else if (!selectedField?.props) {
        properQuestion = '';
      } else if (selectedField.props['label']) {
        properQuestion = selectedField.props['label'];
      } else if (selectedField.props['secondaryLabel']) {
        properQuestion = selectedField.props['secondaryLabel'];
      } else {
        properQuestion = '';
      }

      let properAnswer = '';
      let headerText: string | null = null;
      if (fields[0].type === 'empty') {
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
        properAnswer = selectedOption.label;
      } else {
        xmlKey = selectedField?.props?.['xmlKey'] ?? '/';
        stringValue = selectedField?.props?.['stringValue'] ?? null;
        if (typeof model[answerKey] === 'boolean') {
          properAnswer = model[answerKey] ? 'Ja' : 'Nein';
        } else {
          properAnswer = (model[answerKey] as any).toString();
        }
      }

      answerObject[answerKey] = {
        value: model[answerKey],
        xmlKey: xmlKey,
        stringValue: stringValue,
        type: type,
        componentId: componentID,
        questionText: properQuestion,
        answerText: properAnswer,
        headerText: headerText,
      };
    }
    return answerObject;
  }
}
