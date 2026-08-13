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
  selector: 'sh-eun-gw19',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-gw19.component.html',
  styles: ``,
})
export class EunGw19Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'Gw19';
  readonly meistergruendungspraemieUrl =
    'https://www.ib-sh.de/produkt/meistergruendungspraemie-schleswig-holstein/';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];

  //Overarching check that decides if this question gets skipped
  static isAllowed(_answers: Record<string, unknown>): boolean {
    const check0 = [
      'us1Ans-2',
      'us1Ans-3',
      'us1Ans-5',
      'us1Ans-6',
      'us1Ans-7',
      'us1Ans-8',
      'us1Ans-9',
      'us1Ans-10',
    ].includes(_answers['Us1'] as string);
    const check1 = [
      'us1Ans-2',
      'us1Ans-3',
      'us1Ans-5',
      'us1Ans-6',
      'us1Ans-7',
      'us1Ans-8',
      'us1Ans-9',
      'us1Ans-10',
    ].includes(_answers['HwkBranche'] as string);
    return check0 || check1;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'Gw19',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Wird Dein Startup erstmal eine Nebentätigkeit sein?',
          required: true,
          tooltip:
            'Hast Du neben diesem Startup (zumindest vorerst) noch eine Hauptbeschäftigung?\nWenn Du Dir über die Abgrenzung zwischen Haupt- und Nebentätigkeit nicht sicher bist. Sprich mit jemandem aus dem startuphafen.sh Netzwerk - geh dafür auf den Reiter "Kontakte"!',
          options: [
            {
              value: 'gw19Ans-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey: '/',
            },
            {
              value: 'gw19Ans-2',
              label: 'Nein',
              stringValue: 'false',
              xmlKey: '/',
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
        EunGw19Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }

  shouldShowMeistergruendungspraemieHint(): boolean {
    if (this.model['Gw19'] !== 'gw19Ans-2') {
      return false;
    }
    const hwkEntryType = this.model['HwkEntryType'];
    if (
      this.model['Us1'] === 'us1Ans-2' ||
      this.model['HwkBranche'] === 'us1Ans-2'
    ) {
      return hwkEntryType === undefined || hwkEntryType === 'hwkEntryAns-1';
    } else {
      return false;
    }
  }
}
