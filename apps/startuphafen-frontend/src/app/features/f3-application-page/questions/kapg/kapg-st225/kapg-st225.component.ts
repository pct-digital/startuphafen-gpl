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
  selector: 'sh-kapg-st225',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st225.component.html',
  styles: ``,
})
export class KapgSt225Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St225';

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
        key: 'St225',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Falls Du in der Baubranche tätig bist: Willst Du eine Bescheinigung zur Freistellung vom Steuerabzug bei Bauleistungen beantragen?',
          required: true,
          tooltip: null,
          options: [
            {
              value: 'st225Ans-1',
              label: 'Ja',
              xmlKey: 'Freistellungsbescheinigung/AntragFreistBauabzugsSt',
              stringValue: 'true',
            },
            {
              value: 'st225Ans-2',
              label: 'Nein',
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
        KapgSt225Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
