import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyWrapperHeading } from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';

@Component({
  selector: 'sh-kapg-st77',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st77.component.html',
  styles: ``,
})
export class KapgSt77Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St77';

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
        key: 'St77',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Beginn Deiner neuen Tätigkeit',
          xmlKey: 'AllgAngaben/BeginnTaetigkeit/Betriebsbeginn',
          required: true,
          tooltip:
            'Hier gibst Du an, ab wann Deine Gesellschaft tatsächlich geschäftlich aktiv wird und nach außen auftritt. Dieser Zeitpunkt liegt bei Kapitalgesellschaften nach der notariellen Gründung.',
        },
        validators: {
          notBeforeStart: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) =>
              c.value >= f.model.St66,
            message:
              'Der Beginn kann nicht vor dem Datum Deines notariellen Vertrags liegen.',
          },
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt77Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
