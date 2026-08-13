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

@Component({
  selector: 'sh-eun-st111',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st111.component.html',
  styles: ``,
})
export class EunSt111Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'St111';

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
        key: 'St111',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Bitte versuche Deine voraussichtlichen Gewinne gewissenhaft zu schätzen:',
          tooltip: null,
        },
      },
      {
        key: 'St111a-1',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Gewerbebetrieb (Gründungsjahr)',
          required: true,
          xmlKey:
            'FestsetzungsAngaben/VoraussichtlicheEinkuenfte/EinkGewBetr/GruendJahrA',
          placeholder: '',
          tooltip: null,
        },
        expressions: {
          hide: (field) => {
            const check = [
              'us1Ans-2',
              'us1Ans-3',
              'us1Ans-5',
              'us1Ans-6',
              'us1Ans-7',
              'us1Ans-8',
              'us1Ans-9',
              'us1Ans-10',
            ].includes(field.model.Us1);
            return !check;
          },
        },
      },
      {
        key: 'St111a-2',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Gewerbebetrieb (Folgejahr)',
          required: true,
          xmlKey:
            'FestsetzungsAngaben/VoraussichtlicheEinkuenfte/EinkGewBetr/FolgeJahrA',
          placeholder: '',
          tooltip: null,
        },
        expressions: {
          hide: (field) => {
            const check = [
              'us1Ans-2',
              'us1Ans-3',
              'us1Ans-5',
              'us1Ans-6',
              'us1Ans-7',
              'us1Ans-8',
              'us1Ans-9',
              'us1Ans-10',
            ].includes(field.model.Us1);
            return !check;
          },
        },
      },
      {
        key: 'St111b-1',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Selbstständige Arbeit (Gründungsjahr)',
          required: true,
          xmlKey:
            'FestsetzungsAngaben/VoraussichtlicheEinkuenfte/EinkSelbst/GruendJahrA',
          placeholder: '',
          tooltip: null,
        },
        expressions: {
          hide: (field) => {
            const check = [
              'us1Ans-2',
              'us1Ans-3',
              'us1Ans-5',
              'us1Ans-6',
              'us1Ans-7',
              'us1Ans-8',
              'us1Ans-9',
              'us1Ans-10',
            ].includes(field.model.Us1);
            return check;
          },
        },
      },
      {
        key: 'St111b-2',
        type: 'number-euro',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Selbständige Arbeit (Folgejahr)',
          required: true,
          xmlKey:
            'FestsetzungsAngaben/VoraussichtlicheEinkuenfte/EinkSelbst/FolgeJahrA',
          placeholder: '',
          tooltip: null,
        },
        expressions: {
          hide: (field) => {
            const check = [
              'us1Ans-2',
              'us1Ans-3',
              'us1Ans-5',
              'us1Ans-6',
              'us1Ans-7',
              'us1Ans-8',
              'us1Ans-9',
              'us1Ans-10',
            ].includes(field.model.Us1);
            return check;
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
      const keysToDelete = ['St111a-1', 'St111a-2', 'St111b-1', 'St111b-2'];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        EunSt111Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
