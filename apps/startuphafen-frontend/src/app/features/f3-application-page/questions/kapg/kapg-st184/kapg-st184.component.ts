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

@Component({
  selector: 'sh-kapg-st184',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st184.component.html',
  styles: ``,
})
export class KapgSt184Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'St184';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];

  //Overarching check that decides if this question gets skipped
  static isAllowed(_answers: Record<string, unknown>): boolean {
    const check0: boolean = Number(_answers['St183a']) <= 25000;
    const check1: boolean = _answers['St185'] === 'st185Ans-2';
    const check2: boolean = Number(_answers['St183a']) > 25000;

    return check2 || (check0 && check1);
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'St184a',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Willst Du einen geschätzten Erstattungsanspruch aus Vorsteuer oder Umsatzsteuerzahllast angeben?',
          required: true,
          tooltip:
            'Erstattungsanspruch aus Vorsteuer bedeutet, dass Du insgesamt für das Jahr ein Umsatzsteuerguthaben erwartest. Z.B., weil Du hohe Investitionen tätigen musst. Umsatzsteuerzahllast wiederum heißt, dass Du insgesamt Umsatzsteuer zahlen musst, weil die von Dir erhaltene Umsatzsteuer höher ist als die Vorsteuer, die Du abziehen kannst.',
          options: [
            {
              value: 'st184aAns-1',
              label: 'Umsatzsteuerzahllast',
              xmlKey: 'Umsatzsteuer/ZahllastUeberschuss/Auswahl',
              stringValue: '1',
            },
            {
              value: 'st184aAns-2',
              label: 'Erstattungsanspruch aus Vorsteuer',
              xmlKey: 'Umsatzsteuer/ZahllastUeberschuss/Auswahl',
              stringValue: '2',
            },
          ],
        },
      },
      {
        key: 'St184b',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Gib Deinen geschätzten Erstattungsanspruch aus Vorsteuer/Zahllast Betrag an.',
          xmlKey: 'Umsatzsteuer/ZahllastUeberschuss/Betrag',
          required: true,
          placeholder: 'Betrag',
          tooltip:
            'Nur bei der Wahl von Erstattungsanspruch aus Vorsteuer, kann bei passenden Betrag eine monatliche Voranmeldung im Anschluss gewählt werden.',
        },
      },
      {
        key: 'St184c',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Möchtest Du eine monatliche Voranmeldung durchführen?',
          required: true,
          tooltip: null,
          options: [
            {
              value: 'st184cAns-1',
              label: 'Monatliche Voranmeldung annehmen',
              xmlKey: 'Umsatzsteuer/ZahllastUeberschuss/VoranmeldungMonatlich',
              stringValue: 'true',
            },
            {
              value: 'st184cAns-2',
              label: 'Monatliche Voranmeldung ablehnen',
              xmlKey: '/',
            },
          ],
        },
        expressions: {
          hide: (field) => {
            const amount = Number(field.model.St184b);
            const isRefundClaim = field.model.St184a === 'st184aAns-2';
            return !isRefundClaim || !(amount > 9000);
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
      const keysToDelete = ['St184c'];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        KapgSt184Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
