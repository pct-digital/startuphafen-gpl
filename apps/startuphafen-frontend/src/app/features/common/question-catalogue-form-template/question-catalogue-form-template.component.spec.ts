import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import { CatalogueQuestion } from '@startuphafen/startuphafen-common';
import { QuestionCatalogueFormTemplateComponent } from './question-catalogue-form-template.component';

describe('QuestionCatalogueFormTemplateComponent', () => {
  let spectator: Spectator<QuestionCatalogueFormTemplateComponent>;
  const createComponent = createComponentFactory({
    component: QuestionCatalogueFormTemplateComponent,
    imports: [FormlyModule.forRoot(), ReactiveFormsModule, CommonModule],
    providers: [FormBuilder],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  describe('updateForm', () => {
    it('should handle null questionFlow', () => {
      spectator.component.updateForm(null);
      expect(spectator.component.fields).toEqual([]);
      expect(spectator.component.form.value).toEqual({});
    });
    it('should correctly process a simple string type question', () => {
      const mockQuestionFlow: CatalogueQuestion = {
        id: '1',
        questionId: 'q1',
        type: 'string',
        questionText: 'Was ist Ihr Tätigkeitsfeld?',
        validations: [],
        createdAt: '',
        documentId: '',
        publishedAt: '',
        updatedAt: '',
        tooltip: 'tooltip',
        answerOptions: [
          {
            id: 11,
            answerId: 'a1',
            xmlKey: '/',
            answerText: 'Hello',
          },
        ],
      };

      spectator.component.updateForm(mockQuestionFlow);

      expect(spectator.component.fields[0].key).toBe('q1');
      expect(spectator.component.fields[0].props?.label).toBe(
        'Was ist Ihr Tätigkeitsfeld?'
      );
      expect(spectator.component.fields[0].fieldGroup?.[0].type).toBe('string');
    });

    it('should correctly process a multi-single type question', () => {
      const mockQuestionFlow: CatalogueQuestion = {
        id: '2',
        questionId: 'q2',
        type: 'multi-single',
        createdAt: '',
        documentId: '',
        publishedAt: '',
        updatedAt: '',
        questionText: 'Branche der Tätigkeit',
        validations: [],
        tooltip: 'tooltip',
        answerOptions: [
          {
            id: 1,
            answerId: 'a2',
            xmlKey: '/',
            answerText: 'Freiberuflich',
          },
          {
            id: 1,
            answerId: 'a3',
            xmlKey: '/',
            answerText: 'Handwerk',
          },
          {
            id: 1,
            answerId: 'a4',
            xmlKey: '/',
            answerText: 'Dienstleistung',
          },
        ],
      };

      spectator.component.updateForm(mockQuestionFlow);

      expect(spectator.component.fields[0].fieldGroup?.[0].type).toBe(
        'multi-single'
      );
      expect(
        spectator.component.fields[0].fieldGroup?.[0].props?.options
      ).toHaveLength(3);
    });
  });
});
