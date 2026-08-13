import { formatDate } from '@angular/common';
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
  selector: 'sh-eun-st96',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st96.component.html',
  styles: ``,
})
export class EunSt96Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St96';

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
        key: 'St96',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Zu welchem Zeitpunkt hast Du die Tätigkeit offiziell aufgenommen?',
          xmlKey: 'Betrieb/Gruendungsangaben/GruendungsForm/UebertrStichtag',
          required: true,
          placeholder: 'Hier eintragen',
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
          tooltip:
            'Hier geht es um den Zeitpunkt, ab dem Du nach außen erkennbar unternehmerisch tätig geworden bist, z. B. mit Deinem Angebot am Markt auftrittst oder erste Leistungen anbietest. Dieses Datum kann steuerlich für die Gewerbesteuer relevant sein.',
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        EunSt96Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
