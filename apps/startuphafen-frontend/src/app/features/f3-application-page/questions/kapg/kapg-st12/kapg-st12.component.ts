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
  selector: 'sh-kapg-st12',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st12.component.html',
  styles: `
    :host ::ng-deep .phone-group-field {
      display: block;
      width: 100%;
      margin-bottom: 1rem;
    }
    @media (min-width: 768px) {
      :host ::ng-deep .phone-group-field {
        display: inline-block;
        margin-bottom: 0;
        margin-right: 0.5rem;
      }
      :host ::ng-deep .phone-group-field:last-of-type {
        margin-right: 0;
      }
      :host ::ng-deep .phone-group-small {
        width: calc(15% - 0.35rem);
      }
      :host ::ng-deep .phone-group-medium {
        width: calc(22% - 0.35rem);
      }
      :host ::ng-deep .phone-group-large {
        width: calc(61% - 0.3rem);
      }
    }
  `,
})
export class KapgSt12Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St12';

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
        key: 'St12',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Kommunikationsverbindungen des Unternehmens',
        },
      },
      {
        key: 'St12a',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        defaultValue: '+49',
        props: {
          xmlKey: 'AllgAngaben/Komm/Tel/IntVorw',
          required: true,
          disabled: true,
          secondaryLabel: 'Int. Vorwahl',
          tooltip: null,
        },
        className: 'phone-group-field phone-group-small',
      },
      {
        key: 'St12b',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'AllgAngaben/Komm/Tel/NatVorw',
          required: true,
          secondaryLabel: 'Nat. Vorwahl',
          placeholder: '01234',
          tooltip: null,
        },
        className: 'phone-group-field phone-group-medium',
      },
      {
        key: 'St12c',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          xmlKey: 'AllgAngaben/Komm/Tel/RufNr',
          required: true,
          secondaryLabel: 'Rufnummer',
          placeholder: '123456789',
          tooltip: null,
        },
        className: 'phone-group-field phone-group-large',
      },
      {
        key: 'St14',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          secondaryLabel: 'Internetadresse',
          xmlKey: 'AllgAngaben/Komm/Web/Adresse',
          placeholder: 'Internetadresse (optional)',
          pattern:
            '^((https?|ftp|smtp)://)?(www.)?[a-zA-Z0-9_-]+.[a-z]+(/[a-zA-Z0-9#_-]+/?)*$',
          tooltip: null,
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt12Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
