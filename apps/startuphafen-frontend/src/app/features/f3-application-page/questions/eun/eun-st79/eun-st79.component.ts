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
  selector: 'sh-eun-st79',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st79.component.html',
  styles: ``,
})
export class EunSt79Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St79';

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
        key: 'St79',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Wann bist Du mit den ersten Vorbereitungen für Dein Startup gestartet?',
          xmlKey: 'Betrieb/BetrBeginn/Betriebsbeginn',
          required: true,
          placeholder: 'Hier eintragen',
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
          tooltip:
            'Hier geht es um erste unternehmerische Vorbereitungshandlungen, z. B. erste Anschaffungen, Beratungen, Materialkäufe oder andere Kosten im Zusammenhang mit Deiner Gründung. Dieses Datum kann steuerlich z. B. für den Vorsteuerabzug relevant sein.',
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        EunSt79Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
