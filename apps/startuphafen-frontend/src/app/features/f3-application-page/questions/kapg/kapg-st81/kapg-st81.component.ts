import { CommonModule } from '@angular/common';
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
import {
  germanTaxIdValidator,
  revalidateTaxIdControls,
  uniqueTaxIdValidator,
} from '../../../german-tax-id.validator';

@Component({
  selector: 'sh-kapg-st81',
  standalone: true,
  imports: [CommonModule, FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st81.component.html',
  styles: `
  @media (min-width: 768px) {
    :host ::ng-deep .w-half {
      display: inline-block;
      width: 50%;
      padding-right: 13rem;
    }
  }

     :host ::ng-deep .column-group-start-even + .column-group-field-even {
      margin-top: 0;
    }
    :host ::ng-deep .column-group-field-even {
      display: inline-block;
      width: 100%;
    }
    @media (min-width: 768px) {
      :host ::ng-deep .column-group-start-even {
        display: block;
      }
      :host ::ng-deep .column-group-field-even {
        display: inline-block;
        width: calc(50% - 0.5rem);
        margin-right: 1rem;
      }
      :host ::ng-deep .column-group-field-even:nth-of-type(even) {
        margin-right: 0;
      }
    }
    :host ::ng-deep .column-group-start-odd + .column-group-field-odd {
      margin-top: 0;
    }
    :host ::ng-deep .column-group-field-odd  {
      display: inline-block;
      width: 100%;
    }
    @media (min-width: 768px) {
      :host ::ng-deep .column-group-start-odd  {
        display: block;
      }
      :host ::ng-deep .column-group-field-odd  {
        display: inline-block;
        width: calc(50% - 0.5rem);
        margin-right: 1rem;
      }
      :host ::ng-deep .column-group-field-odd:nth-of-type(odd) {
        margin-right: 0;
      }
    }

    :host ::ng-deep .first-shareholder-group {
      position: relative;
      display: block;
      border: 2px solid #16a34a;
      border-radius: 0.5rem;
      padding: 1.5rem 1rem 1rem;
      margin-bottom: 1.5rem;
    }
    :host ::ng-deep .first-shareholder-group::before {
      content: 'Antragssteller';
      position: absolute;
      top: 0;
      right: 1rem;
      transform: translateY(-50%);
      background-color: #16a34a;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
    }

  `,
})
export class KapgSt81Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St81';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Output() stepComplete = new EventEmitter<AnswerObject>();
  @Output() answersRemoved = new EventEmitter<string[]>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];

  questionCount = 1;

  //Overarching check that decides if this question gets skipped
  static isAllowed(_answers: Record<string, unknown>): boolean {
    return true;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };

    const existingShareholders = this.getExistingShareholderCount();
    this.questionCount = Math.max(existingShareholders, 1);
    this.rebuildShareholderFields();

    // Subscribe to form value changes to validate percentage sum and to
    // re-validate taxIds so a duplicate error clears on the sibling once the
    // real duplicate is corrected.
    this.form.valueChanges.subscribe(() => {
      this.validatePercentageSum();
      revalidateTaxIdControls(this.form);
    });

    this.validatePercentageSum();
  }

  get totalPercentage(): number {
    let total = 0;
    const formValues = this.form.getRawValue() as Record<string, unknown>;
    for (let i = 0; i < this.questionCount; i++) {
      const value =
        formValues[`St84b_${i}`] !== undefined
          ? formValues[`St84b_${i}`]
          : this.model[`St84b_${i}`];

      if (value != null && value !== '') {
        const parsedValue = parseFloat(value.toString());
        if (!Number.isNaN(parsedValue)) {
          total += parsedValue;
        }
      }
    }
    return Math.round(total * 100) / 100; // Round to 2 decimal places
  }

  get isPercentageSumValid(): boolean {
    return this.totalPercentage === 100;
  }

  get canAddMoreShareholders(): boolean {
    return this.totalPercentage < 100;
  }

  get percentageErrorMessage(): string | null {
    if (this.isPercentageSumValid) {
      return null;
    }

    const diff = Math.abs(100 - this.totalPercentage);
    const roundedDiff = Math.round(diff * 100) / 100;

    if (this.totalPercentage > 100) {
      return `Die Beteiligungen überschreiten 100%. Bitte reduzieren Sie die Anteile um ${roundedDiff}%.`;
    }

    return `Die Beteiligungen müssen sich auf 100% summieren. Es fehlen noch ${roundedDiff}%.`;
  }

  private getExistingShareholderCount(): number {
    const indexes = this.collectShareholderIndexes();
    if (indexes.length === 0) {
      return 0;
    }

    for (
      let normalizedIndex = 0;
      normalizedIndex < indexes.length;
      normalizedIndex++
    ) {
      const currentIndex = indexes[normalizedIndex];
      if (currentIndex !== normalizedIndex) {
        this.renameShareholderIndex(currentIndex, normalizedIndex);
      }
    }

    return indexes.length;
  }

  private collectShareholderIndexes(): number[] {
    return Array.from(
      new Set(
        Object.keys(this.model)
          .filter((key) => key.startsWith('St81_'))
          .map((key) => Number(key.split('_')[1]))
          .filter((value) => !Number.isNaN(value))
      )
    ).sort((a, b) => a - b);
  }

  private renameShareholderIndex(oldIndex: number, newIndex: number): void {
    const updatedModel: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.model)) {
      const match = key.match(/_(\d+)$/);
      if (!match) {
        updatedModel[key] = value;
        continue;
      }

      const currentIndex = Number(match[1]);
      if (currentIndex === oldIndex) {
        const newKey = key.replace(/_(\d+)$/, `_${newIndex}`);
        updatedModel[newKey] = value;
        continue;
      }

      updatedModel[key] = value;
    }

    this.model = updatedModel;
  }

  private rebuildShareholderFields(): void {
    const rebuiltFields: FormlyFieldConfig[] = [];
    for (let i = 0; i < this.questionCount; i++) {
      rebuiltFields.push(...this.getAnteilseignerObject(i));
    }
    this.fields = rebuiltFields;
  }

  private reindexShareholderModel(removedIndex: number): {
    removedKeys: string[];
  } {
    const updatedModel: Record<string, unknown> = {};
    const removedKeys: string[] = [];

    for (const [key, value] of Object.entries(this.model)) {
      const match = key.match(/_(\d+)$/);
      if (!match) {
        updatedModel[key] = value;
        continue;
      }

      const currentIndex = Number(match[1]);

      if (currentIndex === removedIndex) {
        removedKeys.push(key);
        continue;
      }

      const newIndex =
        currentIndex > removedIndex ? currentIndex - 1 : currentIndex;
      const newKey = key.replace(/_(\d+)$/, `_${newIndex}`);
      updatedModel[newKey] = value;
    }

    this.model = updatedModel;
    return { removedKeys };
  }

  private validatePercentageSum(): void {
    if (!this.isPercentageSumValid) {
      const errors = { ...(this.form.errors ?? {}) };
      errors['percentageSum'] = true;
      this.form.setErrors(errors);
      return;
    }

    // Only clear the error if it was set by us
    if (this.form.errors && this.form.errors['percentageSum']) {
      const errors = { ...this.form.errors };
      delete errors['percentageSum'];
      this.form.setErrors(Object.keys(errors).length > 0 ? errors : null);
    }
  }

  private parseDecimalValue(value: number | string): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const normalizedValue = value.trim().replace(',', '.');
      return Number(normalizedValue);
    }

    return Number(value);
  }

  private isPercentMatchingNominal(
    percentValue: number | string,
    totalCapitalValue: number | string,
    nominalValue: number | string
  ): boolean {
    const percent = this.parseDecimalValue(percentValue);
    const totalCapital = this.parseDecimalValue(totalCapitalValue);
    const nominal = this.parseDecimalValue(nominalValue);

    if (
      Number.isNaN(percent) ||
      Number.isNaN(totalCapital) ||
      Number.isNaN(nominal)
    ) {
      return true;
    }

    const calculatedNominal = (totalCapital * percent) / 100;
    return Math.abs(calculatedNominal - nominal) <= 0.01;
  }

  addAnteilseigner() {
    this.questionCount += 1;
    this.rebuildShareholderFields();
    this.validatePercentageSum();
  }

  removeAnteilseigner() {
    if (this.questionCount <= 1) {
      return;
    }

    const removedIndex = this.questionCount - 1;
    const { removedKeys } = this.reindexShareholderModel(removedIndex);
    this.answersRemoved.emit(removedKeys);
    this.questionCount -= 1;
    this.rebuildShareholderFields();
    this.validatePercentageSum();
  }

  async onSubmit() {
    if (this.form.valid) {
      const filteredModel = this.applicationService.filterHiddenFields(
        this.model,
        this.fields
      );

      // When a shareholder is switched between Firma / Natürliche Person, the
      // inactive branch's fields become hidden. Remove their now-stale answers
      // through the presenter's standard deletion path. Only keys that were
      // actually persisted (present in `answers`) are emitted.
      const staleKeys = this.applicationService
        .getHiddenFieldKeys(this.model, this.fields)
        .filter((key) => key in this.answers);
      if (staleKeys.length > 0) {
        this.answersRemoved.emit(staleKeys);
      }

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        KapgSt81Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }

  getAnteilseignerObject(questionKey: number): FormlyFieldConfig[] {
    const fields: FormlyFieldConfig[] = [
      {
        key: `St81_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Anteilseigner Nr.' + Number(questionKey + 1),
          secondaryLabel: 'Laufende Nummer(n) der Geschäftsanteile',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
          placeholder: 'Hier eintragen',
          tooltip:
            'Hier wird festgehalten, welcher Geschäftsanteil zu welchem Anteilseigner gehört. Bitte trage die laufende Nummer des Geschäftsanteils so ein, wie sie im Gesellschaftsvertrag steht. ',
          required: true,
        },
      },
      {
        key: `Us4_${questionKey}`,
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Art des Anteilseigners',
          tooltip: null,
          required: true,
          options: [
            {
              value: `us4_${questionKey}Ans-1`,
              label: 'Firma',
              xmlKey: '/',
            },
            {
              value: `us4_${questionKey}Ans-2`,
              label: 'Natürliche Person',
              xmlKey: '/',
            },
          ],
        },
      },
      //Different from the Ids on the actualy application page as ERiC does it differently
      {
        key: `St82a_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Firmenname',
          xmlKey: 'Gesellschafter/Anteilseigner/NNatPers/Firmenname',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
      },
      {
        key: `St82b_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Art des Betriebes',
          xmlKey: 'Gesellschafter/Anteilseigner/NNatPers/ArtTaetigkeit',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
      },
      {
        key: `St82i_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'Gesellschafter/Anteilseigner/NNatPers/Ordnungskriterium/StNr',
          secondaryLabel: 'Steuernummer',
          placeholder: 'Steuernummer',
          tooltip: null,
          pattern: '([0-9]{4})0[0-9]{8}',
        },
        validation: {
          messages: {
            pattern: 'Format: 4 Ziffern + 0 + 8 Ziffern (13 Ziffern insgesamt)',
          },
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
      },
      {
        key: `St82k_${questionKey}`,
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Adresse',
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
      },
      {
        key: `St82c_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NNatPers/Adrkette/StrAdr/Str',
          required: true,
          secondaryLabel: 'Straße',
          placeholder: 'Straße',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St82d_${questionKey}`,
        type: 'number',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'Gesellschafter/Anteilseigner/NNatPers/Adrkette/StrAdr/HausNr',
          required: true,
          placeholder: 'Hausnummer',
          secondaryLabel: 'Hausnummer',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St82e_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'Gesellschafter/Anteilseigner/NNatPers/Adrkette/StrAdr/HausNrZu',
          placeholder: 'Hausnummerzusatz',
          secondaryLabel: 'Hausnummerzusatz',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St82f_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'Gesellschafter/Anteilseigner/NNatPers/Adrkette/StrAdr/AdressErg',
          secondaryLabel: 'Adressergänzung',
          placeholder: 'Adressergänzung',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St82g_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NNatPers/Adrkette/StrAdr/Plz',
          required: true,
          secondaryLabel: 'Postleitzahl',
          placeholder: 'Postleitzahl',
          pattern: '^[0-9]{5}$',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St82h_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NNatPers/Adrkette/StrAdr/Ort',
          required: true,
          secondaryLabel: 'Ort',
          placeholder: 'Ort',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-1`,
        },
        className: 'column-group-field-even column-group-end-even',
      },
      {
        key: `St83b_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Name',
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Name',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-odd',
      },
      {
        key: `St83d_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Vorname',
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Vorname',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-odd',
      },
      {
        key: `St83f_${questionKey}`,
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Geburtsdatum',
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/GebDat',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-odd column-group-end-odd',
      },
      {
        key: `GwGeschlecht_${questionKey}`,
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Geschlecht',
          tooltip: null,
          required: true,
          options: [
            {
              value: `GwGeschlecht_${questionKey}Ans-1`,
              label: 'Männlich',
              stringValue: 'männlich',
              xmlKey: '/',
            },
            {
              value: `GwGeschlecht_${questionKey}Ans-2`,
              label: 'Weiblich',
              stringValue: 'weiblich',
              xmlKey: '/',
            },
            {
              value: `GwGeschlecht_${questionKey}Ans-3`,
              label: 'Divers',
              stringValue: 'divers',
              xmlKey: '/',
            },
          ],
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
      },
      {
        key: `GwGeburtsort_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Geburtsort',
          xmlKey: '/',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-odd',
      },
      {
        key: `GwStaat_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Staatsangehörigkeit',
          xmlKey: '/',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-odd',
      },
      {
        key: `St83g_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Berufliche Tätigkeit',
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Berufsbez',
          placeholder: 'Hier eintragen',
          required: true,
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
      },
      {
        key: `St82o_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/PersIdNr',
          required: true,
          secondaryLabel: 'Identifikationsnummer',
          placeholder: 'Identifikationsnummer',
          tooltip: null,
          pattern: '[0-9]{11}',
        },
        validation: {
          messages: {
            pattern: 'Format: 11 Ziffern',
            germanTaxId: 'Bitte gib eine gültige Identifikationsnummer ein.',
            uniqueTaxId:
              'Diese Identifikationsnummer wurde bereits für einen anderen Anteilseigner verwendet.',
          },
        },
        validators: {
          germanTaxId: {
            expression: germanTaxIdValidator,
          },
          uniqueTaxId: {
            expression: uniqueTaxIdValidator,
          },
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
      },
      {
        key: `St83n_${questionKey}`,
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Adresse',
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
      },

      {
        key: `St83h_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Adrkette/StrAdr/Str',
          required: true,
          secondaryLabel: 'Straße',
          placeholder: 'Straße',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St83i_${questionKey}`,
        type: 'number',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Adrkette/StrAdr/HausNr',
          required: true,
          placeholder: 'Hausnummer',
          secondaryLabel: 'Hausnummer',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St83j_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'Gesellschafter/Anteilseigner/NatPers/Adrkette/StrAdr/HausNrZu',
          placeholder: 'Hausnummerzusatz',
          secondaryLabel: 'Hausnummerzusatz',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St83k_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey:
            'Gesellschafter/Anteilseigner/NatPers/Adrkette/StrAdr/AdressErg',
          secondaryLabel: 'Adressergänzung',
          placeholder: 'Adressergänzung',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St83l_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Adrkette/StrAdr/Plz',
          required: true,
          secondaryLabel: 'Postleitzahl',
          placeholder: 'Postleitzahl',
          pattern: '^[0-9]{5}$',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-even',
      },
      {
        key: `St83m_${questionKey}`,
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/NatPers/Adrkette/StrAdr/Ort',
          required: true,
          secondaryLabel: 'Ort',
          placeholder: 'Ort',
          tooltip: null,
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
        className: 'column-group-field-even column-group-end-even',
      },
      {
        key: `St84a_${questionKey}`,
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Beteiligung',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/Nominal',
          required: true,
          secondaryLabel: 'Höhe der Beteiligung nominell',
          placeholder: 'Höhe der Beteiligung nominell',
          tooltip: null,
          allowNegatives: true,
        },
        validators: {
          stamm: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) =>
              Number(c.value) <= Number(f.model.St80),
            message:
              'Der Nominalbetrag kann nicht über den eingezahlten Betrag des Stamm-/ Grund-Kapitals liegen.',
          },
        },
      },
      {
        key: `St84b_${questionKey}`,
        type: 'percent',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/ProzentAnteil',
          required: true,
          secondaryLabel: 'Höhe der Beteiligung in Prozent',
          placeholder: 'Höhe der Beteiligung in Prozent',
          tooltip: null,
        },
        validators: {
          percentMatch: {
            expression: (c: AbstractControl, f: FormlyFieldConfig) =>
              this.isPercentMatchingNominal(
                c.value,
                f.model.St80,
                f.model[`St84a_${questionKey}`]
              ),
            message:
              'Die angegebene Prozentzahl muss mit dem relativen Anteil des Nominalbetrags zum eingezahlten Betrag übereinstimmen.',
          },
        },
      },
    ];

    // For the first shareholder only (the one present from the start), the
    // Geburtsort, Staatsangehörigkeit and the natürliche-Person address fields
    // are not collected and therefore removed.
    if (questionKey === 0) {
      const firstShareholderRemovedKeys = [
        `St83b_${questionKey}`,
        `St83d_${questionKey}`,
        `GwGeschlecht_${questionKey}`,
        `St83f_${questionKey}`,
        `GwGeburtsort_${questionKey}`,
        `GwStaat_${questionKey}`,
        `St83n_${questionKey}`,
        `St83h_${questionKey}`,
        `St83i_${questionKey}`,
        `St83j_${questionKey}`,
        `St83k_${questionKey}`,
        `St83l_${questionKey}`,
        `St83m_${questionKey}`,
      ];
      const firstShareholderFields = fields.filter(
        (field) => !firstShareholderRemovedKeys.includes(field.key as string)
      );

      // Hint that the removed personal fields are sourced from BundID. Only
      // relevant when the first shareholder is a natürliche Person.
      const bundIdInfoBox: FormlyFieldConfig = {
        type: 'info-box',
        props: {
          label: 'Weitere persönliche Daten werden aus deiner BundID gezogen',
        },
        expressions: {
          hide: (field: any) =>
            field.model[`Us4_${questionKey}`] !== `us4_${questionKey}Ans-2`,
        },
      };
      const us4Index = firstShareholderFields.findIndex(
        (field) => field.key === `Us4_${questionKey}`
      );
      firstShareholderFields.splice(us4Index + 1, 0, bundIdInfoBox);

      // Visually mark the first shareholder (the applicant) with a green
      // bordered box and an "Antragssteller" label via the wrapping group's
      // className. The group has no key, so the model paths are unaffected.
      return [
        {
          className: 'first-shareholder-group',
          fieldGroup: firstShareholderFields,
        },
      ];
    }

    return fields;
  }
}
