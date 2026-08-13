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
  selector: 'sh-kapg-st172',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st172.component.html',
  styles: ``,
})
export class KapgSt172Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St172';

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
        key: 'St172_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Angaben zur Festsetzung von Vorauszahlungen (Körperschaftssteuer, Gewerbesteuer)',
          tooltip: null,
        },
      },
      {
        key: 'St172a',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Jahresüberschuss/Steuerbilanzgewinn',
          secondaryLabel: 'Gründungsjahr',
          tooltip: null,
          required: true,
          xmlKey: 'FestsetzungsAngaben/Gewinn/GruendJahr',
        },
      },
      {
        key: 'St172b',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Folgejahr',
          tooltip: null,
          required: true,
          xmlKey: 'FestsetzungsAngaben/Gewinn/FolgeJahr',
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt172Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
