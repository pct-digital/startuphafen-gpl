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
import { FormlyWrapperHeading } from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';

@Component({
  selector: 'sh-kapg-st185',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st185.component.html',
  styles: ``,
})
export class KapgSt185Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St185';

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

    return check0;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'St185',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Willst Du die Kleinunternehmerregelung annehmen?',
          required: true,
          tooltip: `
Die Kleinunternehmerregelung ist eine vereinfachte Regelung für kleinere Unternehmen: Du stellst Rechnungen ohne Umsatzsteuer aus, kannst dafür aber die Umsatzsteuer auf deine eigenen Ausgaben nicht zurückholen.
Lehnst du die Regelung ab, berechnest du regulär Umsatzsteuer und kannst im Gegenzug Vorsteuer geltend machen. Diese Entscheidung bindet dich in der Regel für fünf Jahre. Dein Steuerberater kann dich hier weiter beraten. `,
          options: [
            {
              value: 'st185Ans-1',
              label: 'Kleinunternehmerregelung annehmen',
              xmlKey: 'Umsatzsteuer/KleinunternehmerRegelung/KleinUnternUSt',
              stringValue: 'true',
            },
            {
              value: 'st185Ans-2',
              label: 'Kleinunternehmerregelung ablehnen',
              xmlKey:
                'Umsatzsteuer/KleinunternehmerRegelung/KleinUnternUStVerzicht',
              stringValue: 'true',
            },
          ],
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt185Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
