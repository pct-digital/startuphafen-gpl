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
  selector: 'sh-eun-st149',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st149.component.html',
  styles: ``,
})
export class EunSt149Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St149';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];

  //Overarching check that decides if this question gets skipped
  static isAllowed(_answers: Record<string, unknown>): boolean {
    const check0: boolean = Number(_answers['St132-1']) <= 25000;
    const check1: boolean = _answers['St134'] === 'st134Ans-2';
    const check2: boolean = Number(_answers['St132-1']) > 25000;

    return check2 || (check0 && check1);
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'St149',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Ich berechne die Umsatzsteuer nach',
          required: true,
          tooltip:
            'Bei der Sollversteuerung zählt der Zeitpunkt Deiner Leistung. Bei der Istversteuerung zählt der Zeitpunkt, an dem Dein Kunde bezahlt. Für Gewerbetreibende ist die Istversteuerung in der Regel nur möglich, wenn der Umsatz im Vorjahr 800.000 € nicht überschritten hat. ',
          options: [
            {
              value: 'st149Ans-1',
              label: 'Sollversteuerung',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/AuswahlSollIstVerst',
              stringValue: '1',
            },
            {
              value: 'st149Ans-2',
              label: 'Istversteuerung',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/AuswahlSollIstVerst',
              stringValue: '2',
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
        EunSt149Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
