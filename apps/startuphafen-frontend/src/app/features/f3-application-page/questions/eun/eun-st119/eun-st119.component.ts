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
  selector: 'sh-eun-st119',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st119.component.html',
  styles: ``,
})
export class EunSt119Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St119';

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
        key: 'St119',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Wie ermittelst Du Deinen steuerlichen Gewinn?',
          required: true,
          tooltip:
            'Für Kleinunternehmen empfiehlt sich die Einnahmenüberschussrechnung. Wenn Dein Gewinn über 80.000 Euro oder Dein Umsatz über 800.000 Euro liegt, wirst Du eine Bilanz und eine Gewinn- und Verlustrechnung aufstellen müssen. Dabei ist die Unterstützung eines Steuerberaters sinnvoll. ',

          options: [
            {
              value: 'st119Ans-1',
              label: 'Einnahmeüberschussrechnung',
              xmlKey: 'GewinnErmittlgsAngaben/GewinnErmittlung',
              stringValue: '01',
            },
            {
              value: 'st119Ans-2',
              label: 'Betriebsvermögensvergleich (Bilanz)',
              xmlKey: 'GewinnErmittlgsAngaben/GewinnErmittlung',
              stringValue: '02',
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
        EunSt119Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
