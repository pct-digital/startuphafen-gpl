import { AsyncPipe } from '@angular/common';
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
import { startWith, switchMap } from 'rxjs';
import { OzgInfoService } from '../../../../common/ozg-info/ozg-info.service';
import { ApplicationPageService } from '../../../application-page.service';

@Component({
  selector: 'sh-kapg-st3',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, AsyncPipe],
  templateUrl: './kapg-st3.component.html',
  styles: `
    :host ::ng-deep .address-group-start + .address-group-field {
      margin-top: 0;
    }
    :host ::ng-deep .address-group-field {
      display: inline-block;
      width: 100%;
    }
    @media (min-width: 768px) {
      :host ::ng-deep .address-group-start {
        display: block;
      }
      :host ::ng-deep .address-group-field {
        display: inline-block;
        width: calc(50% - 0.5rem);
        margin-right: 1rem;
      }
      :host ::ng-deep .address-group-field:nth-of-type(even) {
        margin-right: 0;
      }
    }
  `,
})
export class KapgSt3Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private ozgInfoService = inject(OzgInfoService);
  static readonly componentId = 'St3';

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
        key: 'St3',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Angaben zum Startup',
          xmlKey: 'AllgAngaben/Firmenname',
          secondaryLabel: 'Eingetragener Name Deines Startups',
          required: true,
          placeholder: 'Firmenname laut Handelsregister',
          tooltip: null,
        },
      },
      {
        key: 'St4_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Geschäftsadresse',
        },
      },
      {
        key: 'St4',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          placeholder: 'Straße',
          secondaryLabel: 'Straße',
          xmlKey: 'AllgAngaben/Adrkette/StrAdr/Str',
          required: true,
        },
        className: 'address-group-field',
      },
      {
        key: 'St5a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          placeholder: 'Hausnummer',
          secondaryLabel: 'Hausnummer',
          pattern: /^\d+$/,
          required: true,
          xmlKey: 'AllgAngaben/Adrkette/StrAdr/HausNr',
        },
        className: 'address-group-field',
      },
      {
        key: 'St5b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          placeholder: 'Hausnummerzusatz',
          xmlKey: 'AllgAngaben/Adrkette/StrAdr/HausNrZu',
          secondaryLabel: 'Hausnummerzusatz',
        },
        className: 'address-group-field',
      },
      {
        key: 'St5c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          placeholder: 'Adressergänzung',
          xmlKey: 'AllgAngaben/Adrkette/StrAdr/AdressErg',
          secondaryLabel: 'Adressergänzung',
        },
        className: 'address-group-field',
      },
      {
        key: 'St6a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          placeholder: 'Postleitzahl',
          secondaryLabel: 'Postleitzahl',
          pattern: '^[0-9]{5}$',
          required: true,
          xmlKey: 'AllgAngaben/Adrkette/StrAdr/Plz',
        },
        className: 'address-group-field',
      },
      {
        key: 'St6b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          placeholder: 'Ort',
          xmlKey: 'AllgAngaben/Adrkette/StrAdr/Ort',
          secondaryLabel: 'Ort',
          required: true,
        },
        className: 'address-group-field address-group-end',
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt3Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }

  oeidMissing$ = this.form.valueChanges.pipe(
    startWith(() => this.postalCodeMissingOeid()),
    switchMap(() => this.postalCodeMissingOeid())
  );

  async postalCodeMissingOeid(): Promise<boolean> {
    const postalCode = this.model['St6a'] as string | undefined;
    if (typeof postalCode === 'string' && /^\d{5}$/.test(postalCode.trim())) {
      const info = await this.ozgInfoService.lookupPlz(postalCode);
      return !info.some((entry) => entry.oeid !== undefined);
    }
    return false;
  }
}
