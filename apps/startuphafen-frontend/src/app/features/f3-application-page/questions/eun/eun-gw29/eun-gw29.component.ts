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
import {
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';

const GW29_FLENSBURG_CHAMBER = 'Handwerkskammer Flensburg';
const GW29_LUEBECK_CHAMBER = 'Handwerkskammer Lübeck';
const GW29_HWK_CHAMBER_OPTIONS = [
  {
    value: GW29_FLENSBURG_CHAMBER,
    label: GW29_FLENSBURG_CHAMBER,
    stringValue: GW29_FLENSBURG_CHAMBER,
    xmlKey: '/',
  },
  {
    value: GW29_LUEBECK_CHAMBER,
    label: GW29_LUEBECK_CHAMBER,
    stringValue: GW29_LUEBECK_CHAMBER,
    xmlKey: '/',
  },
];

@Component({
  selector: 'sh-eun-gw29',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-gw29.component.html',
  styles: ``,
})
export class EunGw29Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private trpcService = inject(TrpcService);
  static readonly componentId = 'Gw29';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];

  //Overarching check that decides if this question gets skipped
  static isAllowed(_answers: Record<string, unknown>): boolean {
    const check0 = ['us1Ans-2'].includes(_answers['Us1'] as string);
    const check1 = ['us1Ans-2'].includes(_answers['HwkBranche'] as string);

    return check0 || check1;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = { ...this.answers };
    this.fields = [
      {
        key: 'Gw29',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Liegt für Dich eine Handwerkskarte vor?',
          required: true,
          tooltip:
            'Wenn Du schon einen Eintrag bei der Handwerkskammer hast, wirst Du diesen nicht erneut über startuphafen.sh beantragen müssen.',
          options: [
            {
              value: 'gw29Ans-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey: '/',
            },
            {
              value: 'gw29Ans-2',
              label: 'Nein',
              stringValue: 'false',
              xmlKey: '/',
            },
          ],
        },
      },
      {
        key: 'Gw29a',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Bei welcher Handwerkskammer bist Du eingetragen?',
          required: true,
          tooltip: null,
          options: GW29_HWK_CHAMBER_OPTIONS,
        },
        expressions: {
          hide: (field) => field.model.Gw29 !== 'gw29Ans-1',
        },
      },
      {
        key: 'Gw29b',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Ausstellungsdatum',
          xmlKey: '/',
          placeholder: 'Hier eintragen',
          tooltip: null,
          required: true,
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
        },
        expressions: {
          hide: (field) => field.model.Gw29 !== 'gw29Ans-1',
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
      const keysToDelete = ['Gw29a', 'Gw29b'];

      await this.trpcService.client.Answers.batchDelete.mutate({
        projectId: this.projectId,
        keys: keysToDelete,
      });

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        EunGw29Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
