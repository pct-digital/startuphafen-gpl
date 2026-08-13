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
  PctLoaderService,
  ShButtonDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import { CHECKLIST_DOCUMENTS } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-document-upload',
  standalone: true,
  imports: [CommonModule, ShButtonDirective],
  templateUrl: './document-upload.component.html',
  styles: [
    `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-fade-in {
        animation: fadeIn 0.5s ease-out forwards;
      }
    `,
  ],
})
export class DocumentUploadComponent implements OnInit {
  constructor(private trpc: TrpcService) {}
  private loaderService = inject(PctLoaderService);

  contractFile: File | null = null;
  shareholderFile: File | null = null;
  hrgFile: File | null = null;

  previouslyUploaded = {
    contract: false,
    shareholder: false,
    hrg: false,
  };

  error: string | null = null;

  @Input() isUploading = false;
  @Input() projectId = -1;
  @Output() completionChange = new EventEmitter<boolean>();
  @Output() fileSelectedChange = new EventEmitter<boolean>();

  async ngOnInit() {
    await this.loaderService.doWhileLoading(
      'DocumentUploadComponent:ngOnInit',
      async () => {
        const documents =
          await this.trpc.client.UserDocuments.listByProject.query({
            projectId: this.projectId,
          });

        this.previouslyUploaded.contract = documents.some(
          (doc) => doc.filename === CHECKLIST_DOCUMENTS.GS_CONTRACT
        );
        this.previouslyUploaded.shareholder = documents.some(
          (doc) => doc.filename === CHECKLIST_DOCUMENTS.SH_CONTRACT
        );
        this.previouslyUploaded.hrg = documents.some(
          (doc) => doc.filename === CHECKLIST_DOCUMENTS.HR_EXTRACT
        );
      }
    );
  }

  triggerFileInput(input: HTMLInputElement) {
    input.click();
  }

  onFileSelected(event: Event, target: 'contract' | 'shareholder' | 'hrg') {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    if (file.type !== 'application/pdf') {
      this.error = 'Bitte nur PDF-Dateien hochladen.';
      this.completionChange.emit(false);
      this.fileSelectedChange.emit(false);

      this.isInvalidFile(target, input);

      return;
    }
    // Uploads are limited to 1 MB (well below the ERiC transport limit).
    if (file.size > 1 * 1024 * 1024) {
      this.error = 'Die Datei ist zu groß (max. 1MB).';

      return;
    }

    this.error = null;

    switch (target) {
      case 'contract':
        this.contractFile = file;
        break;
      case 'shareholder':
        this.shareholderFile = file;
        break;
      case 'hrg':
        this.hrgFile = file;
        break;
      default:
        break;
    }

    if (this.contractFile && this.shareholderFile && this.hrgFile) {
      this.completionChange.emit(true);
    }
    if (this.contractFile || this.shareholderFile || this.hrgFile) {
      this.fileSelectedChange.emit(true);
    }

    input.value = '';
  }

  async uploadFiles() {
    this.error = null;
    try {
      if (this.contractFile) {
        const fileData = await this.readFileAsUint8Array(this.contractFile);

        await this.trpc.client.UserDocuments.uploadOverwriteFilename.mutate({
          file: fileData,
          projectId: this.projectId,
          filename: CHECKLIST_DOCUMENTS.GS_CONTRACT,
          mimeType: 'application/pdf',
        });
      }
      if (this.shareholderFile) {
        const fileData = await this.readFileAsUint8Array(this.shareholderFile);

        await this.trpc.client.UserDocuments.uploadOverwriteFilename.mutate({
          file: fileData,
          projectId: this.projectId,
          filename: CHECKLIST_DOCUMENTS.SH_CONTRACT,
          mimeType: 'application/pdf',
        });
      }
      if (this.hrgFile) {
        const fileData = await this.readFileAsUint8Array(this.hrgFile);

        await this.trpc.client.UserDocuments.uploadOverwriteFilename.mutate({
          file: fileData,
          projectId: this.projectId,
          filename: CHECKLIST_DOCUMENTS.HR_EXTRACT,
          mimeType: 'application/pdf',
          documentCase: 'hwk_hr_extract',
        });
      }

      this.contractFile = null;
      this.shareholderFile = null;
      this.hrgFile = null;
      this.previouslyUploaded = {
        contract: true,
        shareholder: true,
        hrg: true,
      };
      this.completionChange.emit(false);
      this.fileSelectedChange.emit(false);
    } catch (err) {
      this.error = 'Fehler beim Upload. Bitte versuche es erneut.';
      throw err;
    }
  }

  private async readFileAsUint8Array(file: File) {
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  private isInvalidFile(
    target: 'contract' | 'shareholder' | 'hrg',
    input: HTMLInputElement
  ) {
    switch (target) {
      case 'contract':
        this.contractFile = null;
        break;
      case 'shareholder':
        this.shareholderFile = null;
        break;
      case 'hrg':
        this.hrgFile = null;
        break;

      default:
        break;
    }

    input.value = '';
  }
}
