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
  selector: 'sh-eun-st11',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st11.component.html',
  styles: ``,
})
export class EunSt11Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St11';

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
        key: 'St11',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Bist Du Mitglied einer Religionsgemeinschaft?',
          required: true,
          tooltip:
            'Diese Information bezieht sich auf die Kirchensteuer, die für die steuerliche Erfassung nötig ist.',
          options: [
            {
              value: 'st11Ans-1',
              label: 'Nicht Kirchensteuerpflichtig',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '11',
            },
            {
              value: 'st11Ans-2',
              label: 'Römisch-katholisch',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '03',
            },
            {
              value: 'st11Ans-3',
              label: 'Evangelisch',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '02',
            },
            {
              value: 'st11Ans-4',
              label: 'Evangelisch-reformiert',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '05',
            },
            {
              value: 'st11Ans-5',
              label: 'Evangelisch-reformierte Kirche Bückeburg',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '20',
            },
            {
              value: 'st11Ans-6',
              label: 'Evangelisch-reformierte Kirche Stadthagen',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '21',
            },
            {
              value: 'st11Ans-7',
              label: 'Französisch-reformiert',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '07',
            },
            {
              value: 'st11Ans-8',
              label: 'Freie Religionsgemeinschaft Alzey',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '16',
            },
            {
              value: 'st11Ans-9',
              label: 'Freireligiöse Landesgemeinde Baden',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '13',
            },
            {
              value: 'st11Ans-10',
              label: 'Freireligiöse Landesgemeinde Pfalz',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '14',
            },
            {
              value: 'st11Ans-11',
              label: 'Freireligiöse Gemeinde Mainz',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '15',
            },
            {
              value: 'st11Ans-12',
              label: 'Freireligiöse Gemeinde Offenbach',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '17',
            },
            {
              value: 'st11Ans-13',
              label: 'Israelitische Religionsgemeinschaft Baden',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '25',
            },
            {
              value: 'st11Ans-14',
              label: 'Jüdische Gemeinden im Landesverband Hessen',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '19',
            },
            {
              value: 'st11Ans-15',
              label:
                'Landesverband der israelitischen Kultusgemeinden in Bayern',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '26',
            },
            {
              value: 'st11Ans-16',
              label: 'Jüdische Gemeinde Frankfurt (Hessen)',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '18',
            },
            {
              value: 'st11Ans-17',
              label: 'Jüdische Kultusgemeinden Bad Kreuznach und Koblenz',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '27',
            },
            {
              value: 'st11Ans-18',
              label: 'Israelitisch (Saarland)',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '28',
            },
            {
              value: 'st11Ans-19',
              label: 'Israelitische Religionsgemeinschaft Württemberg',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '12',
            },
            {
              value: 'st11Ans-20',
              label: 'Nordrhein-Westfalen: Israelitisch (jüdisch)',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '29',
            },
            {
              value: 'st11Ans-21',
              label: 'Jüdische Gemeinde Hamburg',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '24',
            },
            {
              value: 'st11Ans-22',
              label: 'Altkatholisch',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '04',
            },
            {
              value: 'st11Ans-23',
              label: 'Sonstige',
              xmlKey: 'AllgAngaben/Inhaber/NatPers/Religion',
              stringValue: '10',
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
        EunSt11Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
