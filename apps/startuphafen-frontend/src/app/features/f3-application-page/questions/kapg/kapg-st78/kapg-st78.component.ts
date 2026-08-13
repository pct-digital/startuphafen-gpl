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
  selector: 'sh-kapg-st78',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st78.component.html',
  styles: ``,
})
export class KapgSt78Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'St78';

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
        key: 'St78a',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Liegt ein abweichendes Wirtschaftsjahr vor?',
          required: true,
          tooltip:
            'Ein abweichendes Wirtschaftsjahr liegt nur vor, wenn Dein Geschäftsjahr bewusst vom Kalenderjahr abweicht, also z. B. vom 1. März bis 28. Februar. Eine Gründung mitten im Jahr bedeutet nicht automatisch ein abweichendes Wirtschaftsjahr. Maßgeblich ist, was in Deinem Gesellschaftsvertrag oder Deiner Satzung geregelt ist.',
          options: [
            {
              value: 'st78aAns-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey:
                'AllgAngaben/GewinnErmittlgsAngaben/MerkerAbwWirtschaftsjahr',
            },
            {
              value: 'st78aAns-2',
              label: 'Nein',
              stringValue: 'false',
              xmlKey:
                'AllgAngaben/GewinnErmittlgsAngaben/MerkerAbwWirtschaftsjahr',
            },
          ],
        },
      },
      {
        key: 'St78c',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'AllgAngaben/GewinnErmittlgsAngaben/AbwWJ_ab',
          secondaryLabel: 'ab den',
          required: true,
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St78a !== 'st78aAns-1',
        },
      },
      {
        key: 'St79',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Höhe des Grund- oder Startkapitals',
          xmlKey: 'AllgAngaben/HoeheGrundStammkapital/Grundstammkapital',
          secondaryLabel: 'Höhe des Grund- und Stammkapitals',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        validators: {
          mind_25k: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) => {
              if (f.model.St74 === 'st74Ans-1') {
                return Number(c.value) >= 25000;
              } else {
                return true;
              }
            },
            message:
              'Bei einer GmbH muss das Startkapital mind. 25000€ betragen.',
          },
        },
      },
      {
        key: 'St80',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'AllgAngaben/HoeheGrundStammkapital/Eingezahlteskapital',
          secondaryLabel: 'Davon sind eingezahlt: ',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        validators: {
          startkapital: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) =>
              Number(c.value) <= Number(f.model.St79),
            message:
              'Der eingezahlte Betrag kann nicht den Gesamtbetrag übersteigen.',
          },
          mind_half: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) =>
              Number(c.value) >= Number(f.model.St79) / 2,
            message:
              'Der eingezahlte Betrag muss mind. Die Hälfte des Startkapitals sein.',
          },
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

      // Cleanup logic: delete all potentially conflicting keys from DB
      const keysToDelete = ['St78c', 'St78d'];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        KapgSt78Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
