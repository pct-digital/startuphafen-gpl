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
  selector: 'sh-kapg-st74',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st74.component.html',
  styles: ``,
})
export class KapgSt74Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St74';

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
        key: 'St74',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Welche Gesellschaftsform willst Du für Dein Startup wählen?',
          required: true,
          tooltip:
            'Der Hauptunterschied zwischen UG und GmbH liegt im Stammkapital, in der Rücklagenpflicht und im Firmenzusatz: Die UG (Mini-GmbH) kann mit 1 € gegründet werden und muss einen Teil ihres Jahresüberschusses als Rücklage bilden. Die GmbH benötigt 25.000 € Stammkapital und hat diese besondere Rücklagenpflicht nicht. Die UG muss außerdem den Zusatz „haftungsbeschränkt“ führen, die GmbH nicht. ',
          options: [
            {
              value: 'st74Ans-1',
              label: 'GmbH',
              stringValue: '350',
              xmlKey: 'AllgAngaben/Rechtsform/RechtsformId',
            },
            {
              value: 'st74Ans-2',
              label: 'UG',
              stringValue: '370',
              xmlKey: 'AllgAngaben/Rechtsform/RechtsformId',
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
        KapgSt74Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
