import { formatDate } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';
import {
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../../hwk/hwk-utils';

const PERMIT_TOOLTIP =
  'Die Erlaubnispflicht ergibt sich entweder aus dem Gaststättengesetz, aus der Gewerbeordnung § 34 ff oder anderen Gesetzen. Sie lassen sich grob in die Bereiche Gastronomie, Immobilienbranche, Finanzanlagen und Verkehrsunternehmen unterteilen. Du bist Dir unsicher, ob Du eine Erlaubnis brauchst? Sprich mit jemandem aus dem startuphafen.sh Netzwerk - geh dafür auf den Reiter "Kontakte"!';
const ALLOWED_BRANCH_VALUES = [
  'us1Ans-2',
  'us1Ans-3',
  'us1Ans-5',
  'us1Ans-6',
  'us1Ans-7',
  'us1Ans-8',
  'us1Ans-9',
  'us1Ans-10',
];

@Component({
  selector: 'sh-eun-gw28',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-gw28.component.html',
  styles: ``,
})
export class EunGw28Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'Gw28';

  @Input() answers: AnswerObject | QuestionAnswerValues = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, AnswerObject[string]['value']> = {};
  fields: FormlyFieldConfig[] = [];

  //Overarching check that decides if this question gets skipped
  static isAllowed(answers: QuestionAnswerValues): boolean {
    const us1Value = answers['Us1'];
    const hwkBrancheValue = answers['HwkBranche'];
    const hasAllowedUs1 =
      typeof us1Value === 'string' && ALLOWED_BRANCH_VALUES.includes(us1Value);
    const hasAllowedHwkBranche =
      typeof hwkBrancheValue === 'string' &&
      ALLOWED_BRANCH_VALUES.includes(hwkBrancheValue);

    return hasAllowedUs1 || hasAllowedHwkBranche;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'Gw28_0',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Unterliegt Dein Gewerbe einer Erlaubnispflicht?',
          required: true,
          tooltip: PERMIT_TOOLTIP,
          options: [
            {
              value: 'gw28_0Ans-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey: '/',
            },
            {
              value: 'gw28_0Ans-2',
              label: 'Nein',
              stringValue: 'false',
              xmlKey: '/',
            },
          ],
        },
      },
      {
        key: 'Gw28',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Liegt Dir bereits eine Erlaubnis vor?',
          required: true,
          options: [
            {
              value: 'gw28Ans-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey: '/',
            },
            {
              value: 'gw28Ans-2',
              label:
                'Nein, hiermit möchte ich eine Erlaubnispflicht beantragen',
              stringValue: 'false',
              xmlKey: '/',
            },
          ],
        },
        expressions: {
          hide: (field) => field.model.Gw28_0 !== 'gw28_0Ans-1',
        },
      },
      {
        key: 'Gw28a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Erteilende Behörde der Erlaubnis',
          xmlKey: '/',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Gw28 !== 'gw28Ans-1',
        },
      },
      {
        key: 'Gw28b',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Ausstellungsdatum der Erlaubnis',
          xmlKey: '/',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
        },
        expressions: {
          hide: (field) => field.model.Gw28 !== 'gw28Ans-1',
        },
      },
    ];
  }

  async onSubmit() {
    if (this.form.valid) {
      // Filter out hidden fields from the model
      const filteredModel = this.applicationService.filterHiddenFields(
        this.model,
        this.fields
      );

      // Cleanup logic: delete all potentially conflicting keys from DB
      const keysToDelete = ['Gw28', 'Gw28a', 'Gw28b'];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        EunGw28Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
