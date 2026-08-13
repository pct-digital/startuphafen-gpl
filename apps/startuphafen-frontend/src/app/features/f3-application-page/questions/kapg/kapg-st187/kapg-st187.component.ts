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
import {
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';

const AGRICULTURE_FORESTRY_BRANCH = 'us1Ans-1';
const AVERAGE_RATE_TAXATION_MAX_REVENUE = 600000;

@Component({
  selector: 'sh-kapg-st187',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st187.component.html',
  styles: `
   @media (min-width: 768px) {
    :host ::ng-deep .row-field-left {
      display: inline-block;
      width: calc(60% - 1rem);
      margin-right: 1rem;
      vertical-align: top;
    }
    :host ::ng-deep .row-field-right {
      width: 40%;
      display: inline-block;
      vertical-align: top;
    }
  }
  `,
})
export class KapgSt187Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'St187';

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

  private isAverageRateTaxationAllowed(
    model: Record<string, unknown>
  ): boolean {
    const revenue = Number(model['St183a']);
    return (
      model['HwkBranche'] === AGRICULTURE_FORESTRY_BRANCH &&
      Number.isFinite(revenue) &&
      revenue <= AVERAGE_RATE_TAXATION_MAX_REVENUE
    );
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'St187a',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Steuerbefreiung',
          required: true,
          tooltip:
            'Hier geht es um Umsätze, die gesetzlich von der Umsatzsteuer befreit sind, zum Beispiel bestimmte Leistungen im Gesundheitsbereich, bei Vermietung, Finanz- und Versicherungsleistungen oder bestimmte Bildungsleistungen. ',
          options: [
            {
              value: 'st187aAns-1',
              label: 'Ja',
              xmlKey: 'Umsatzsteuer/Steuerbefreiung/MerkerSteuerbefreiung',
              stringValue: 'true',
            },
            {
              value: 'st187aAns-2',
              label: 'Nein',
              xmlKey: 'Umsatzsteuer/Steuerbefreiung/MerkerSteuerbefreiung',
              stringValue: 'false',
            },
          ],
        },
      },
      {
        key: 'St187b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          required: true,
          secondaryLabel: 'Art des Umsatzes / Tätigkeit',
          xmlKey: 'Umsatzsteuer/Steuerbefreiung/UmsatzArt',
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St187a !== 'st187aAns-1',
        },
        className: 'row-field-left',
      },
      {
        key: 'St187c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          required: true,
          secondaryLabel: 'Umsatzsteuerfrei nach § 4 UStG, Absatz:',
          xmlKey: 'Umsatzsteuer/Steuerbefreiung/UStGNr',
          placeholder: 'Hier eintragen',
          tooltip:
            'Gib bitte an, welche Umsätze oder Tätigkeiten bei Dir steuerfrei sind und welcher Absatz aus § 4 UStG dazu passt. Wenn Du unsicher bist, kannst Du in § 4 UStG nachsehen, welcher Fall zu Deinem Umsatz/ Deiner Tätigkeit passt. ',
        },
        expressions: {
          hide: (field) => field.model.St187a !== 'st187aAns-1',
        },
        className: 'row-field-right',
      },
      {
        key: 'St188a',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Ermäßigter Steuersatz',
          required: true,
          tooltip:
            'Hier geht es um Umsätze, bei denen ein niedrigerer Umsatzsteuersatz gilt. Das kann je nach Tätigkeit zum Beispiel bestimmte Lebensmittel, Bücher oder einzelne weitere Leistungen betreffen. ',
          options: [
            {
              value: 'st188aAns-1',
              label: 'Ja',
              xmlKey: 'Umsatzsteuer/ErmSteuersatz/Abs2/MerkerSteuersatz',
              stringValue: 'true',
            },
            {
              value: 'st188aAns-2',
              label: 'Nein',
              xmlKey: 'Umsatzsteuer/ErmSteuersatz/Abs2/MerkerSteuersatz',
              stringValue: 'false',
            },
          ],
        },
      },
      {
        key: 'St188b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          required: true,
          secondaryLabel: 'Art des Umsatzes / Tätigkeit',
          xmlKey: 'Umsatzsteuer/ErmSteuersatz/Abs2/UmsatzArt',
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St188a !== 'st188aAns-1',
        },
        className: 'row-field-left',
      },
      {
        key: 'St188c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          required: true,
          secondaryLabel: 'ermäßigt nach § 12 Absatz 2 UStG Nummer: ',
          xmlKey: 'Umsatzsteuer/ErmSteuersatz/Abs2/UStGNr',
          placeholder: 'Hier eintragen',
          tooltip:
            'Gib bitte an, welche Umsätze oder Tätigkeiten bei Dir dem ermäßigten Steuersatz unterliegen. Trage außerdem die passende Nummer aus § 12 Abs. 2 UStG ein. Wenn Du unsicher bist, kannst Du dort nachsehen, welcher Fall zu Deinem Umsatz oder Deiner Tätigkeit passt. ',
        },
        expressions: {
          hide: (field) => field.model.St188a !== 'st188aAns-1',
        },
        className: 'row-field-right',
      },
      {
        key: 'St189a',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Durchschnittsbesteuerung',
          required: true,
          tooltip:
            'Dieses Thema betrifft vor allem land- und forstwirtschaftliche Betriebe. Wenn Deine Gesellschaft nicht in diesem Bereich tätig ist, ist hier in der Regel „Nein“ passend. ',
          options: [
            {
              value: 'st189aAns-1',
              label: 'Ja',
              xmlKey:
                'Umsatzsteuer/Durchschnittssatzbesteuerung/MerkerDurchschnittssatzbesteuerung',
              stringValue: 'true',
            },
            {
              value: 'st189aAns-2',
              label: 'Nein',
              xmlKey:
                'Umsatzsteuer/Durchschnittssatzbesteuerung/MerkerDurchschnittssatzbesteuerung',
              stringValue: 'false',
            },
          ],
        },
        expressions: {
          hide: (field) => !this.isAverageRateTaxationAllowed(field.model),
        },
      },
      {
        key: 'St189b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          required: true,
          secondaryLabel: 'Art des Umsatzes / Tätigkeit',
          xmlKey: 'Umsatzsteuer/Durchschnittssatzbesteuerung/UmsatzArt',
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field) =>
            field.model.St189a !== 'st189aAns-1' ||
            !this.isAverageRateTaxationAllowed(field.model),
        },
        className: 'row-field-left',
      },
      {
        key: 'St189c',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          required: true,
          label: 'Umsätze nach § 24 UStG',
          tooltip:
            'Bitte wähle die passende Nummer aus § 24 UStG für die Umsätze oder Tätigkeiten, die unter die Durchschnittsbesteuerung fallen.',
          options: [
            {
              value: 'st189cAns-1',
              label:
                'Nr. 1 - Forstwirtschaftliche Erzeugnisse, ausgen. Sägewerkserzeugnisse (5,5 %)',
              xmlKey: 'Umsatzsteuer/Durchschnittssatzbesteuerung/UStGNr',
              stringValue: '1',
            },
            {
              value: 'st189cAns-2',
              label:
                'Nr. 2 - Sägewerkserzeugnisse und Getränke sowie alkoholische Flüssigkeiten (19 %)',
              xmlKey: 'Umsatzsteuer/Durchschnittssatzbesteuerung/UStGNr',
              stringValue: '2',
            },
            {
              value: 'st189cAns-3',
              label: 'Nr. 3 - Übrige Umsätze (7,8 %)',
              xmlKey: 'Umsatzsteuer/Durchschnittssatzbesteuerung/UStGNr',
              stringValue: '3',
            },
          ],
        },
        expressions: {
          hide: (field) =>
            field.model.St189a !== 'st189aAns-1' ||
            !this.isAverageRateTaxationAllowed(field.model),
        },
      },
      {
        key: 'St189d',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Ich nehme die Durchschnittsbesteuerung in Anspruch',
          required: true,
          tooltip:
            'Bei Beantwortung mit "Nein" verzichtest Du auf die Durchschnittsbesteuerung.',
          options: [
            {
              value: 'st189dAns-1',
              label: 'Ja',
              xmlKey:
                'Umsatzsteuer/Durchschnittssatzbesteuerung/InanspruchVerzicht/AnspruchDurchschnitt',
              stringValue: 'true',
            },
            {
              value: 'st189dAns-2',
              label: 'Nein',
              xmlKey:
                'Umsatzsteuer/Durchschnittssatzbesteuerung/InanspruchVerzicht/VerzichtDurchschnitt',
              stringValue: 'true',
            },
          ],
        },
        expressions: {
          hide: (field) =>
            field.model.St189a !== 'st189aAns-1' ||
            !this.isAverageRateTaxationAllowed(field.model),
        },
        className: 'row-field-right',
      },
    ];
  }

  async onSubmit() {
    if (this.form.valid) {
      const filteredModel = this.applicationService.filterHiddenFields(
        this.model,
        this.fields
      );

      // Cleanup logic: delete all potentially conflicting keys from DB
      const keysToDelete = [
        'St187b',
        'St187c', // St187a fields
        'St188b',
        'St188c', // St188a fields
        'St188a-2',
        'St188b-2',
        'St188c-2',
        'St189a', // St188a-2 fields
        'St189b',
        'St189c',
        'St189d', // St189a fields
      ];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        KapgSt187Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
