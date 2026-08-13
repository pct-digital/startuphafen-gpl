import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  FormlyWrapperHeading,
  PctLoaderService,
  readFileAsUint8Array,
  ShButtonDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';

export interface Person {
  // Unique per shareholder row. Note: upload state itself is keyed by taxId;
  // duplicate taxIds are prevented by uniqueTaxIdValidator.
  index: number;
  name: string;
  taxId: string;
  // The applicant (first shareholder) sources name/birth date from BundID, so
  // these fields are not collected in the St81 form and may be missing here.
  birthDate?: string;
}

@Component({
  selector: 'sh-identification-upload',
  standalone: true,
  imports: [CommonModule, ShButtonDirective, FormlyModule, ReactiveFormsModule],
  templateUrl: './identification-upload.component.html',
  styles: ``,
})
export class IdentificationUploadComponent implements OnInit {
  private trpc = inject(TrpcService);
  private loader = inject(PctLoaderService);
  @ViewChild('identificationInput')
  identificationInput!: ElementRef<HTMLInputElement>;
  selecting: Person | null = null;
  files: Map<string, File> = new Map();
  error: string | null = null;
  people: Person[] = [];

  @Input() projectId!: number;
  private applicationService = inject(ApplicationPageService);
  @Output() stepComplete = new EventEmitter<AnswerObject>();
  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() catalogueId = '';
  // Historical identifier: this component originated in the (now removed)
  // GbR question flow. The id is persisted in question tracking data and in
  // the CMS question catalogue, so it must not be renamed.
  static readonly componentId = 'gbr-identification-upload';
  static isAllowed(_answers: Record<string, unknown>): boolean {
    return true;
  }
  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [
    {
      key: 'GbrIdentificationUploadHeading',
      type: 'empty',
      wrappers: [FormlyWrapperHeading],
      props: {
        label: 'Bitte lade die Ausweiskopie der mitgründenden Person hoch',
        tooltip:
          'Diese Angaben werden benötigt, um Deine Anträge für die zuständigen Ämter zu vervollständigen.',
      },
    },
  ];
  async onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        IdentificationUploadComponent.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }

  validateFiles() {
    for (const person of this.people) {
      const file = this.files.get(person.taxId);
      if (!file) {
        this.form.setErrors({
          identificationMissing: true,
        });
        return;
      }
    }
    this.form.setErrors(null);
  }

  getShareholderIndices(keys: string[]): number[] {
    return Array.from(
      new Set(
        keys
          .filter((key) => key.startsWith('St82o_'))
          .map((key) => Number(key.split('_')[1]))
          .filter((value) => !Number.isNaN(value))
      )
    ).sort((a, b) => a - b);
  }
  //The logged-in applicant is always the first shareholder row (index 0). We must
  //drop exactly that row - not the lowest existing St82o_ index - because a Firma
  //at index 0 has no St82o_ answer, which would otherwise skip a real natural person.
  getUploadShareholderIndices(keys: string[]): number[] {
    const indices = this.getShareholderIndices(keys);
    return this.catalogueId === 'kapg'
      ? indices.filter((index) => index !== 0)
      : indices;
  }

  async ngOnInit() {
    await this.loader.doWhileLoading(
      'IdentificationUploadComponent:ngOnInit',
      async () => {
        this.model = { ...this.answers };
        const people: Person[] = [];
        for (const i of this.getUploadShareholderIndices(
          Object.keys(this.model)
        )) {
          const firstName = this.model[`St83d_${i}`] as string | undefined;
          const lastName = this.model[`St83b_${i}`] as string | undefined;
          // The applicant (first shareholder) has no name in the form, since it
          // is sourced from BundID; fall back to a generic label.
          const name =
            [firstName, lastName].filter(Boolean).join(' ') ||
            (i === 0 ? 'Antragsteller' : '');
          people.push({
            index: i,
            name,
            taxId: this.model[`St82o_${i}`] as string,
            birthDate: this.model[`St83f_${i}`] as string | undefined,
          });
        }
        this.people = people;
        await Promise.all(
          people.map(async (person) => {
            const data =
              await this.trpc.client.IdentificationDocuments.getData.query({
                taxId: person.taxId,
                projectId: this.projectId,
              });
            if (data) {
              const file = new File([data.data], data.fileName, {
                type: data.mimeType,
              });
              this.files.set(person.taxId, file);
            }
          })
        );

        this.validateFiles();
      }
    );
  }

  async onFileSelected(event: Event) {
    await this.loader.doWhileLoading(
      'IdentificationUploadComponent:onFileSelected',
      async () => {
        this.error = null;
        const input = event.target as HTMLInputElement;

        try {
          if (this.selecting === null) return;
          const selected = this.selecting;
          if (!input.files?.length) return;
          const file = input.files[0];
          if (file.size > 10 * 1024 * 1024) {
            this.error = 'Die Datei ist zu groß (max. 10MB).';
            return;
          }
          await this.trpc.client.IdentificationDocuments.upload.mutate({
            file: await readFileAsUint8Array(file),
            taxId: selected.taxId,
            mimeType: file.type as
              | 'image/png'
              | 'image/jpeg'
              | 'application/pdf',
            fileName: file.name,
            projectId: this.projectId,
          });
          this.files.set(selected.taxId, file);
        } catch (e) {
          this.error = 'Fehler beim Hochladen der Datei.';
        } finally {
          input.value = '';
        }

        this.validateFiles();
      }
    );
  }

  selectFile(person: Person) {
    this.selecting = person;
    this.identificationInput.nativeElement.click();
  }

  formatDate(date: string | undefined): string {
    if (!date) {
      return '';
    }
    const [year, month, day] = date.split('-').map(Number);
    const output = new Date(year, month - 1, day);
    return output.toLocaleDateString('de-DE');
  }

  getFileName(taxId: string) {
    const fileName = this.files.get(taxId)?.name;
    return fileName ?? '';
  }
}
