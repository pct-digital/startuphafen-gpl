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

@Component({
  selector: 'sh-kapg-st201',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st201.component.html',
  styles: ``,
})
export class KapgSt201Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'St201';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
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
        key: 'St201',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Steuerschuldnerschaft des Leistungsempfängers bei Bau- und / oder Gebäudereinigungsleistungen',
          secondaryLabel:
            'Es wird die Erteilung eines Nachweises zur Steuerschuldnerschaft des Leistungsempfängers bei Bau- und / oder Gebäudereinigungsleistungen (Vordruck USt 1 TG) beantragt.',
          required: true,
          tooltip: null,
          options: [
            {
              value: 'st201Ans-1',
              label: 'Ja',
              xmlKey: 'Umsatzsteuer/SteuerschuldnerschaftLE/NachweisBeantragt',
              stringValue: 'true',
            },
            {
              value: 'st201Ans-2',
              label: 'Nein',
              xmlKey: '/',
            },
          ],
        },
      },
      {
        key: 'St202',
        type: 'checkbox',
        wrappers: [FormlyWrapperHeading],
        props: {
          textSplitOne:
            'Der Umfang der ausgeführten Bauleistungen im Sinne des § 13b Absatz 2 Nummer 4 UStG beträgt voraussichtlich mehr als 10 Prozent des Weltumsatzes (Summe der im Inland steuerbaren und nicht steuerbaren Umsätze).',
          requiredTrue: true,
          tooltip: null,
          xmlKey: 'Umsatzsteuer/SteuerschuldnerschaftLE/UmfangBauleistungen',
        },
        validators: {
          reqTrue: {
            expression: (c: AbstractControl) => {
              if (typeof c.value === 'boolean') return c.value;
              const val = c.value ?? '';
              return val === 'true';
            },
            message: 'Dieses Feld muss angenommen werden.',
          },
        },
        expressions: {
          hide: (field) => field.model.St201 !== 'st201Ans-1',
        },
      },
      {
        key: 'St203',
        type: 'checkbox',
        wrappers: [FormlyWrapperHeading],
        props: {
          textSplitOne:
            'Der Umfang der ausgeführten Gebäudereinigungsleistungen im Sinne des § 13b Absatz 2 Nummer 8 UStG beträgt voraussichtlich mehr als 10 Prozent des Weltumsatzes (Summe der im Inland steuerbaren und nicht steuerbaren Umsätze).',
          tooltip: null,
          xmlKey:
            'Umsatzsteuer/SteuerschuldnerschaftLE/UmfangGebaeudereinigung',
        },
        validators: {
          reqTrue: {
            expression: (c: AbstractControl) => {
              if (typeof c.value === 'boolean') return c.value;
              const val = c.value ?? '';
              return val === 'true';
            },
            message: 'Dieses Feld muss angenommen werden.',
          },
        },
        expressions: {
          hide: (field) => field.model.St201 !== 'st201Ans-1',
        },
      },
    ];
  }

  async onSubmit() {
    if (this.form.valid) {
      const filteredModel = this.applicationService.filterHiddenFields(
        this.model,
        this.fields
      );

      const keysToDelete = ['St202', 'St203'];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        KapgSt201Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
