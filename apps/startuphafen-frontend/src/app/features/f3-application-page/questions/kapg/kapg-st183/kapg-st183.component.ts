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
  selector: 'sh-kapg-st183',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st183.component.html',
  styles: ``,
})
export class KapgSt183Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St183';

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
        key: 'St183',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Bitte schätze Deinen Umsatz für dieses Kalenderjahr und für das Folgejahr.',
          tooltip: 'Umsatz ist die Summe Deiner betrieblichen Einnahmen.',
        },
      },
      {
        key: 'St183a',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Dieses Jahr',
          required: true,
          xmlKey: 'Umsatzsteuer/GesUmsatz/GruendJahr',
          placeholder: '',
          tooltip: null,
        },
      },

      {
        key: 'St183b',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Folgejahr',
          required: true,
          xmlKey: 'Umsatzsteuer/GesUmsatz/FolgeJahr',
          placeholder: '',
          tooltip: null,
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt183Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
