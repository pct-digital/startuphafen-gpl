import { formatDate } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';
import { QuestionAnswerValues } from '../../hwk/hwk-utils';

@Component({
  selector: 'sh-kapg-st66',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st66.component.html',
  styles: `
    :host ::ng-deep .column-group-start-even + .column-group-field-even {
      margin-top: 0;
    }
    :host ::ng-deep .column-group-field-even {
      display: inline-block;
      width: 100%;
    }
    @media (min-width: 768px) {
      :host ::ng-deep .column-group-start-even {
        display: block;
      }
      :host ::ng-deep .column-group-field-even {
        display: inline-block;
        width: calc(50% - 0.5rem);
        margin-right: 1rem;
      }
      :host ::ng-deep .column-group-field-even:nth-of-type(even) {
        margin-right: 0;
      }
    }
    :host ::ng-deep .column-group-start-odd + .column-group-field-odd {
      margin-top: 0;
    }
    :host ::ng-deep .column-group-field-odd  {
      display: inline-block;
      width: 100%;
    }
    @media (min-width: 768px) {
      :host ::ng-deep .column-group-start-odd  {
        display: block;
      }
      :host ::ng-deep .column-group-field-odd  {
        display: inline-block;
        width: calc(50% - 0.5rem);
        margin-right: 1rem;
      }
      :host ::ng-deep .column-group-field-odd:nth-of-type(odd) {
        margin-right: 0;
      }
    }
  `,
})
export class KapgSt66Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'St66';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: QuestionAnswerValues = {};
  fields: FormlyFieldConfig[] = [];

  //Overarching check that decides if this question gets skipped
  static isAllowed(_answers: Record<string, unknown>): boolean {
    return true;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'St66_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Informationen zur notariellen Gründung',
        },
      },
      {
        key: 'St66',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Wann hast Du beim Notar gegründet?',
          xmlKey: 'AllgAngaben/NotarVertrag/DatumGVertrag',
          required: true,
          placeholder: 'Hier eintragen',
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
          tooltip: null,
        },
      },
      {
        key: 'St69a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'AllgAngaben/NotarVertrag/GruendungsNotar/Name',
          secondaryLabel: 'Nachname des Notars',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        className: 'column-group-field-even',
      },
      {
        key: 'St69b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'AllgAngaben/NotarVertrag/GruendungsNotar/Vorname',
          secondaryLabel: 'Vorname des Notars',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        className: 'column-group-field-even',
      },
      {
        key: 'Us3',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Handelt es sich bei der Adresse des Notars um eine Postfachadresse?',
          required: true,
          tooltip: null,
          options: [
            {
              value: 'us3Ans-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey: '/',
            },
            {
              value: 'us3Ans-2',
              label: 'Nein',
              stringValue: 'false',
              xmlKey: '/',
            },
          ],
        },
      },
      {
        key: 'St70_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Geschäftsadresse',
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-2',
        },
      },
      {
        key: 'St70',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/StrAdr/Str',
          required: true,
          secondaryLabel: 'Straße',
          placeholder: 'Straße',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-2',
        },
        className: 'column-group-field-even',
      },
      {
        key: 'St71a',
        type: 'number',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/StrAdr/HausNr',
          required: true,
          placeholder: 'Hausnummer',
          secondaryLabel: 'Hausnummer',
          pattern: /^\d+$/,
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-2',
        },
        className: 'column-group-field-even',
      },
      {
        key: 'St71b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/StrAdr/HausNrZu',
          placeholder: 'Hausnummerzusatz',
          secondaryLabel: 'Hausnummerzusatz',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-2',
        },
        className: 'column-group-field-even',
      },
      {
        key: 'St71c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/StrAdr/AdressErg',
          secondaryLabel: 'Adressergänzung',
          placeholder: 'Adressergänzung',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-2',
        },
        className: 'column-group-field-even',
      },

      {
        key: 'St72a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/StrAdr/Plz',
          required: true,
          secondaryLabel: 'Postleitzahl',
          placeholder: 'Postleitzahl',
          tooltip: null,
          pattern: '^[0-9]{5}$',
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-2',
        },
        className: 'column-group-field-even',
      },
      {
        key: 'St72b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/StrAdr/Ort',
          required: true,
          secondaryLabel: 'Ort',
          placeholder: 'Ort',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-2',
        },
        className: 'column-group-field-even column-group-end-even',
      },
      {
        key: 'St73_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Postfachadresse',
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-1',
        },
      },
      {
        key: 'St73a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/PostfAdr/Plz',
          required: true,
          placeholder: 'Postleitzahl',
          secondaryLabel: 'Postleitzahl',
          tooltip: null,
          pattern: '^[0-9]{5}$',
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-1',
        },
        className: 'column-group-field-odd',
      },
      {
        key: 'St73b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/PostfAdr/Ort',
          required: true,
          secondaryLabel: 'Ort',
          placeholder: 'Ort',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-1',
        },
        className: 'column-group-field-odd',
      },
      {
        key: 'St73c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'AllgAngaben/NotarVertrag/GruendungsNotar/Adrkette/PostfAdr/Postfach',
          required: true,
          secondaryLabel: 'Postfach',
          placeholder: 'Postfach',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.Us3 !== 'us3Ans-1',
        },
        validators: {
          postfach: {
            expression: (c: AbstractControl) => new String(c.value).length <= 6,
          },
        },
        className: 'column-group-field-odd column-group-end-odd',
      },
      {
        key: 'St67_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Angaben zum Handelsregisterantrag',
        },
      },
      {
        key: 'St67a',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Eintragung beantragt am:',
          xmlKey: 'AllgAngaben/NotarVertrag/HrgAngaben/TagDesAntrags',
          required: true,
          tooltip: null,
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
        },
      },
      {
        key: 'St67c',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Eintragung erfolgt am: ',
          xmlKey: 'AllgAngaben/NotarVertrag/HrgAngaben/TagDerEintragung',
          required: true,
          tooltip: null,
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
        },
        validators: {
          eintrag: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) =>
              c.value >= f.model.St67a,
            message:
              'Tag der Eintragung kann nicht vor dem Datum des Antrags liegen.',
          },
        },
      },
      {
        key: 'St68a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Beim Amtsgericht:',
          secondaryLabel: 'Ort',
          xmlKey: 'AllgAngaben/NotarVertrag/HrgAngaben/HandelsregisterGericht',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
      },
      {
        key: 'St68c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'AllgAngaben/NotarVertrag/HrgAngaben/HrgRegisternummer',
          secondaryLabel: 'Registernummer',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
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
      const keysToDelete = [
        // Us3: Both Postfach and Street address fields
        'St70',
        'St71a',
        'St71b',
        'St71c',
        'St72a',
        'St72b',
        'St73a',
        'St73b',
        'St73c',
        // St67: All Handelsregister related fields
        'St67a',
        'St67b',
        'St67c',
        'St68a',
        'St68b',
        'St68c',
      ];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        KapgSt66Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
