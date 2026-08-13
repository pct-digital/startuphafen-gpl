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
  selector: 'sh-kapg-st176',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st176.component.html',
  styles: ``,
})
export class KapgSt176Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St176';

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
        key: 'St176a',
        type: 'number',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Angaben zur Anmeldung und Abführung der Lohnsteuer',
          secondaryLabel: 'a) Zahl der Arbeitnehmer',
          xmlKey: 'LohnberechnungsStelle/AnzahlBeschaeftigteArbeitnehmer',
          tooltip: null,
          required: true,
        },
      },
      {
        key: 'St176b',
        type: 'number',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel:
            'b) von a) Zahl der Gesellschafter oder deren Ehegatten',
          xmlKey: 'LohnberechnungsStelle/AnzahlGesellschafterBeschaeftigte',
          tooltip: null,
          required: true,
        },
        validators: {
          employeeCheck: {
            expression: (c: AbstractControl, field: FormlyFieldConfig) =>
              Number(c.value) <= Number(field.model.St176a),
            message: () =>
              'Die angebene Anzahl an Gesellschaftern oder deren Ehegatten darf nicht die Gesamtanzahl aus a) überschreiten.',
          },
        },
      },
      {
        key: 'St176c',
        type: 'number',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'c) von a) Zahl der geringfügig Beschäftigten',
          xmlKey: 'LohnberechnungsStelle/AnzahlGeringfuegigBeschaeftigte',
          tooltip: null,
          required: true,
        },
        validators: {
          employeeCheck: {
            expression: (c: AbstractControl, field: FormlyFieldConfig) =>
              Number(c.value) <= Number(field.model.St176a),
            message: () =>
              'Die angebene Anzahl an geringfügig Beschäftigten darf nicht die Gesamtanzahl aus a) überschreiten.',
          },
        },
      },
      {
        key: 'St177',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Beginn der Lohnzahlungen',
          xmlKey: 'LohnberechnungsStelle/BeginnLohnzahlungen',
          tooltip:
            'Gemeint ist das Datum, ab wann erstmals Gehalt oder Lohn gezahlt wird. Das kann ein Geschäftsführer-Gehalt sein oder die erste Zahlung an einen Mitarbeitenden. Der Zweck des Feldes ist, dass das Finanzamt den Startpunkt für die Lohnsteuer-Anmeldungen einordnen kann. ',
          required: true,
        },
        validators: {
          notBeforeStart: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) =>
              c.value >= f.model.St77,
            message:
              'Die Lohnsteuerzahlungen können nicht vor dem Beginn der Tätigkeit starten.',
          },
        },
      },
      {
        key: 'St178',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Vorraussichtliche Lohnsteuer im Kalenderjahr',
          xmlKey: 'LohnberechnungsStelle/VoraussichtlicheLohnsteuer',
          required: true,
          tooltip:
            'Du kannst auf der Seite des BMF die Lohnsteuer berechnen lassen. <a class="text-blue-200 underline" target="_blank" href="https://www.bmf-steuerrechner.de/">Steuerrechner</a>',
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt176Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
