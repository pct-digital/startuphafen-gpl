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
  selector: 'sh-kapg-st190',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st190.component.html',
  styles: ``,
})
export class KapgSt190Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'St190';

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
        key: 'St190',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Ich berechne die Umsatzsteuer nach',
          required: true,
          tooltip:
            'Bei der Sollversteuerung zählt der Zeitpunkt Deiner Leistung. Bei der Istversteuerung zählt der Zeitpunkt, an dem Dein Kunde bezahlt. Für Gewerbetreibende ist die Istversteuerung in der Regel nur möglich, wenn der Umsatz im Vorjahr 800.000 € nicht überschritten hat. ',
          options: [
            {
              value: 'st190Ans-1',
              label: 'Sollversteuerung',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/AuswahlSollIstVerst',
              stringValue: '1',
            },
            {
              value: 'st190Ans-2',
              label: 'Istversteuerung',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/AuswahlSollIstVerst',
              stringValue: '2',
            },
          ],
        },
      },
      {
        key: 'St192',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Warum beantragst Du die Istversteuerung?',
          required: true,
          tooltip:
            'Ist-Besteuerung heißt, dass Du die Umsatzsteuer erst dann an das Finanzamt abführen muss, wenn Dein Kunde Dich bezahlt hat.',
          options: [
            {
              value: 'stAns192-1',
              label:
                'Ich beantrage die Istversteuerung, weil mein erwarteter Umsatz im Gründungsjahr auf das ganze Jahr gerechnet voraussichtlich unter der geltenden Grenze liegt.',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/IstVerstUStGrundUmsatz',
              stringValue: 'true',
            },
            {
              value: 'stAns192-2',
              label:
                'Ich beantrage die Istversteuerung, weil für mich keine Pflicht besteht, Bücher zu führen und regelmäßig Abschlüsse zu erstellen.',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/IstVerstUStGrundAO',
              stringValue: 'true',
            },
          ],
        },
        expressions: {
          hide: (field) => field.model.St190 !== 'st190Ans-2',
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
      const keysToDelete = ['St192'];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        KapgSt190Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
