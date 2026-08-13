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
  selector: 'sh-eun-st150to152',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st150to152.component.html',
  styles: ``,
})
export class EunSt150to152Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St150-152';

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
    const check3: boolean = _answers['St149'] === 'st149Ans-2';

    return (check2 && check3) || (check0 && check1 && check3);
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'St150-152',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Warum beantragst Du die Istversteuerung?',
          required: true,
          tooltip:
            'Ist-Besteuerung heißt, dass Du die Umsatzsteuer erst dann an das Finanzamt abführen muss, wenn Dein Kunde Dich bezahlt hat.',
          options: [
            {
              value: 'stAns150',
              label:
                'Mein voraussichtlicher Jahresumsatz liegt unter der geltenden Umsatzgrenze von 800.000 Euro.',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/IstVerstUStGrundUmsatz',
              stringValue: 'true',
            },
            {
              value: 'stAns151',
              label:
                'Für mich besteht keine Pflicht, Bücher zu führen und regelmäßige Abschlüsse zu erstellen.',
              xmlKey: 'Umsatzsteuer/SollIstVersteuerung/IstVerstUStGrundAO',
              stringValue: 'true',
            },
            {
              value: 'stAns152',
              label:
                'Ich übe einen freien Beruf aus und bin nicht buchführungspflichtig.',
              xmlKey:
                'Umsatzsteuer/SollIstVersteuerung/IstVerstUStGrundFreierBeruf',
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
        EunSt150to152Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
