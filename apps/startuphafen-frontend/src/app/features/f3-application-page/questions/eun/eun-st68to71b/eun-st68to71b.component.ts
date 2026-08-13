import { AsyncPipe } from '@angular/common';
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
import {
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { startWith, switchMap } from 'rxjs';
import { OzgInfoService } from '../../../../common/ozg-info/ozg-info.service';
import { ApplicationPageService } from '../../../application-page.service';
import { AddressValidationService } from '../../../services/address-validation.service';

@Component({
  selector: 'sh-eun-st68to71b',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, AsyncPipe],
  templateUrl: './eun-st68to71b.component.html',
  styles: `
    :host ::ng-deep formly-group {
      display: grid;
      grid-template-columns: 1fr;
      column-gap: 1rem;
      align-items: start;
    }

    @media (min-width: 768px) {
      :host ::ng-deep formly-group {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      :host ::ng-deep formly-group > formly-field:nth-child(-n + 2) {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class EunSt68to71bComponent implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  private addressValidationService = inject(AddressValidationService);
  private ozgInfoService = inject(OzgInfoService);

  static readonly componentId = 'St68-71b';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];

  addressErrorMessage: string | null = null;
  localityErrorMessage: string | null = null;

  //Overarching check that decides if this question gets skipped
  static isAllowed(_answers: Record<string, unknown>): boolean {
    return true;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };

    this.fields = [
      {
        key: 'St68',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Wie lautet Deine Geschäftsadresse?',
          required: true,
          tooltip:
            'Hier gibst Du die Geschäftsadresse Deines Startups an. Das kann die in Deiner BundID hinterlegte private Adresse oder eine andere geschäftliche Anschrift sein.',
          options: [
            {
              value: 'st68Ans-1',
              label: 'Entspricht meiner privaten Adresse',
              xmlKey: 'Betrieb/Unternehmen/EntsprichtWohnanschrift',
              stringValue: 'true',
            },
            {
              value: 'st68Ans-2',
              label: 'Andere Adresse',
              xmlKey: '/',
            },
          ],
        },
      },
      {
        key: 'St69_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Deine Anschrift',
          xmlKey: '/',
        },
        expressions: {
          hide: (field) => field.model.St68 !== 'st68Ans-2',
        },
        modelOptions: {
          updateOn: 'blur',
        },
      },
      {
        key: 'St69',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'Betrieb/Unternehmen/Adrkette/StrAdr/Str',
          required: true,
          placeholder: 'Straße',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St68 !== 'st68Ans-2',
        },
        modelOptions: {
          updateOn: 'blur',
        },
      },
      {
        key: 'St70a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: undefined,
          xmlKey: 'Betrieb/Unternehmen/Adrkette/StrAdr/HausNr',
          required: true,
          placeholder: 'Hausnummer',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St68 !== 'st68Ans-2',
        },
        modelOptions: {
          updateOn: 'blur',
        },
      },
      {
        key: 'St70b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: undefined,
          xmlKey: 'Betrieb/Unternehmen/Adrkette/StrAdr/HausNrZu',
          required: false,
          placeholder: 'Hausnummerzusatz',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St68 !== 'st68Ans-2',
        },
        modelOptions: {
          updateOn: 'blur',
        },
      },
      {
        key: 'St70c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: undefined,
          xmlKey: 'Betrieb/Unternehmen/Adrkette/StrAdr/AdressErg',
          required: false,
          placeholder: 'Adressergänzung',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St68 !== 'st68Ans-2',
        },
        modelOptions: {
          updateOn: 'blur',
        },
      },
      {
        key: 'St71a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: undefined,
          xmlKey: 'Betrieb/Unternehmen/Adrkette/StrAdr/Plz',
          required: true,
          placeholder: 'Postleitzahl',
          tooltip: null,
          pattern: '^[0-9]{5}$',
        },
        expressions: {
          hide: (field) => field.model.St68 !== 'st68Ans-2',
        },
        modelOptions: {
          updateOn: 'blur',
        },
      },
      {
        key: 'St71b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: undefined,
          xmlKey: 'Betrieb/Unternehmen/Adrkette/StrAdr/Ort',
          required: true,
          placeholder: 'Ort',
          tooltip: null,
        },
        expressions: {
          hide: (field) => field.model.St68 !== 'st68Ans-2',
        },
        modelOptions: {
          updateOn: 'blur',
        },

        asyncValidators: {
          postalCodeMatchesLocality: {
            expression: async (c: AbstractControl, f: FormlyFieldConfig) => {
              if (
                f.model.St68 !== 'st68Ans-2' ||
                f.model.St71a === undefined ||
                c.value === undefined
              ) {
                this.localityErrorMessage = null;
                return true;
              }
              const matchesLocality = await Promise.race([
                this.addressValidationService
                  .postalCodeMatchesLocality(f.model.St71a, c.value)
                  .catch(() => true),
                new Promise((resolve) => setTimeout(() => resolve(true), 2500)),
              ]);
              if (!matchesLocality) {
                const localities =
                  await this.addressValidationService.getLocalities(
                    f.model.St71a
                  );
                if (localities.length === 0) {
                  this.localityErrorMessage =
                    'Bitte gib eine gültige Postleitzahl ein.';
                } else {
                  this.localityErrorMessage = `Gültige Orte für diese Postleitzahl: ${localities
                    .slice(0, 5)
                    .map((x) => x.name)
                    .join(', ')}${localities.length > 5 ? ', ...' : ''}`;
                }
              } else {
                this.localityErrorMessage = null;
              }

              return matchesLocality;
            },
          },
          streetExistsInPostalCode: {
            expression: async (c: AbstractControl, f: FormlyFieldConfig) => {
              if (
                f.model.St68 !== 'st68Ans-2' ||
                f.model.St69 === undefined ||
                c.value === undefined
              ) {
                this.addressErrorMessage = null;
                return true;
              }
              const streetExists = await Promise.race([
                this.addressValidationService
                  .streetExistsInPostalCode(
                    f.model.St71a,
                    f.model.St69,
                    c.value
                  )
                  .catch(() => true),
                new Promise((resolve) => setTimeout(() => resolve(true), 2500)),
              ]);
              if (!streetExists) {
                this.addressErrorMessage = `Diese Straße existiert nicht in ${f.model.St71a}, ${c.value}.`;
              } else {
                this.addressErrorMessage = null;
              }
              return streetExists;
            },
          },
        },
      },
    ];
  }

  async onSubmit() {
    if (this.form.valid) {
      // Filter out hidden fields from the model
      const filteredModel = this.applicationService.filterHiddenFields(
        this.model,
        this.fields
      );

      // Cleanup logic: delete all potentially conflicting keys from DB
      const keysToDelete = [
        'St69',
        'St70a',
        'St70b',
        'St70c',
        'St71a',
        'St71b',
      ];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        EunSt68to71bComponent.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }

  async companyPostalCode(): Promise<string | undefined> {
    if (this.model['St68'] === 'st68Ans-1') {
      const user = await this.trpcService.client.User.getUser.query();
      return user.postalCode;
    }
    if (
      typeof this.model['St71a'] === 'string' &&
      /^\d{5}$/.test(this.model['St71a'].trim())
    ) {
      return this.model['St71a'].trim();
    }
    return undefined;
  }

  oeidMissing$ = this.form.valueChanges.pipe(
    startWith(() => this.postalCodeMissingOeid()),
    switchMap(() => this.postalCodeMissingOeid())
  );

  async postalCodeMissingOeid(): Promise<boolean> {
    const postalCode = await this.companyPostalCode();
    if (postalCode === undefined) return false;
    const info = await this.ozgInfoService.lookupPlz(postalCode);
    return !info.some((entry) => entry.oeid !== undefined);
  }
}
