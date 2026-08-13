import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { PctLoaderService, TrpcService } from '@startuphafen/angular-common';
import {
  HwkDocumentCase,
  MAX_HWK_DOCUMENT_SIZE_BYTES,
} from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import {
  HwkDocumentUploadItem,
  HwkDocumentUploadPresentationComponent,
} from './hwk-document-upload-presentation.component';
@Component({
  selector: 'sh-hwk-document-upload-container',
  standalone: true,
  imports: [HwkDocumentUploadPresentationComponent],
  templateUrl: './hwk-document-upload-container.component.html',
})
export class HwkDocumentUploadContainerComponent implements OnInit, OnChanges {
  private trpc = inject(TrpcService);
  private loaderService = inject(PctLoaderService);
  private keycloak = inject(KeycloakService);

  @Input() projectId: number | null = null;
  @Input() documentCase: HwkDocumentCase = 'hwk_qualification_proof';
  @Input() title = 'Dokumente hochladen';
  @Input() description = 'Bitte lade die relevanten Dokumente als PDF hoch.';
  @Input() isRequired = false;
  @Input() requiredHint =
    'Bitte lade mindestens ein Dokument hoch, um fortzufahren.';
  @Input() showRequiredError = false;

  @Output() documentsChanged = new EventEmitter<number | null>();

  readonly maxFiles = 10;
  readonly maxSingleFileBytes = MAX_HWK_DOCUMENT_SIZE_BYTES;
  readonly maxTotalSizeMb = Math.round(
    MAX_HWK_DOCUMENT_SIZE_BYTES / (1024 * 1024)
  );
  readonly roleMissingHint =
    'Für den Dokumenten-Upload musst Du mit BundID verifiziert sein (Vertrauensniveau niedrig oder hoch).';

  documents: HwkDocumentUploadItem[] = [];
  error: string | null = null;
  canUpload = false;
  isLoading = false;
  isUploading = false;

  private deletingDocumentIdsSet = new Set<number>();
  private areRolesInitialized = false;
  private lastLoadedProjectId: number | null = null;
  private lastLoadedDocumentCase: HwkDocumentCase | null = null;

  get deletingDocumentIds(): number[] {
    return Array.from(this.deletingDocumentIdsSet);
  }

  async ngOnInit() {
    const roles = this.keycloak.getUserRoles();
    this.canUpload =
      roles.includes('bundID-low') || roles.includes('bundID-high');
    this.areRolesInitialized = true;
    await this.loadDocumentsIfPossible();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] || changes['documentCase']) {
      await this.loadDocumentsIfPossible();
    }
  }

  async onFileSelected(file: File) {
    if (!this.canUpload) {
      this.error = this.roleMissingHint;
      return;
    }

    const projectId = this.projectId;
    if (projectId == null || projectId <= 0) {
      this.error = 'Die Projekt-ID fehlt. Bitte lade die Seite neu.';
      return;
    }
    if (!this.isPdfFile(file)) {
      this.error = 'Bitte nur PDF-Dateien hochladen.';
      return;
    }

    if (file.size > this.maxSingleFileBytes) {
      this.error = `Die Datei ist zu groß (max. ${this.maxTotalSizeMb} MB).`;
      return;
    }

    if (this.documents.length >= this.maxFiles) {
      this.error = `Maximal ${this.maxFiles} Dokumente pro Fall sind erlaubt.`;
      return;
    }

    this.error = null;
    this.isUploading = true;

    try {
      await this.loaderService.doWhileLoading(
        'HwkDocumentUploadContainerComponent.uploadDocument',
        async () => {
          const fileData = new Uint8Array(await file.arrayBuffer());

          await this.trpc.client.UserDocuments.upload.mutate({
            file: fileData,
            filename: file.name,
            mimeType: 'application/pdf',
            projectId: projectId,
            documentCase: this.documentCase,
          });
        }
      );

      await this.loadDocuments();
    } catch (error: unknown) {
      this.error = this.getUploadErrorMessage(error);
    } finally {
      this.isUploading = false;
    }
  }

  async onDeleteRequested(documentId: number) {
    if (!this.canUpload || this.deletingDocumentIdsSet.has(documentId)) {
      return;
    }

    const projectId = this.projectId;
    if (projectId == null || projectId <= 0) {
      this.error = 'Die Projekt-ID fehlt. Bitte lade die Seite neu.';
      return;
    }
    this.error = null;
    this.deletingDocumentIdsSet.add(documentId);

    try {
      await this.loaderService.doWhileLoading(
        'HwkDocumentUploadContainerComponent.deleteDocument',
        async () => {
          await this.trpc.client.UserDocuments.delete.mutate({
            docId: documentId,
            projectId: projectId,
          });
        }
      );

      await this.loadDocuments();
    } catch (error: unknown) {
      this.error = this.getUploadErrorMessage(error);
    } finally {
      this.deletingDocumentIdsSet.delete(documentId);
    }
  }

  async onReloadRequested() {
    await this.loadDocuments();
  }

  private async loadDocumentsIfPossible() {
    if (!this.areRolesInitialized) {
      return;
    }

    if (!this.canUpload) {
      this.updateDocuments([], null);
      return;
    }

    if (this.projectId == null || this.projectId <= 0) {
      this.updateDocuments([]);
      return;
    }

    if (
      this.lastLoadedProjectId === this.projectId &&
      this.lastLoadedDocumentCase === this.documentCase
    ) {
      return;
    }

    await this.loadDocuments();
  }

  private async loadDocuments() {
    const projectId = this.projectId;
    if (!this.canUpload || projectId == null || projectId <= 0) {
      this.updateDocuments([], this.canUpload ? 0 : null);
      return;
    }

    this.error = null;
    this.isLoading = true;
    try {
      const documents = await this.loaderService.doWhileLoading(
        'HwkDocumentUploadContainerComponent.loadDocuments',
        async () =>
          await this.trpc.client.UserDocuments.listByCase.query({
            projectId: projectId,
            documentCase: this.documentCase,
          })
      );

      const uploadItems = documents.map((document) => ({
        id: document.id,
        filename: document.filename,
        createdAt: document.createdAt,
      }));
      this.updateDocuments(uploadItems, uploadItems.length);
      this.lastLoadedProjectId = projectId;
      this.lastLoadedDocumentCase = this.documentCase;
    } catch (error: unknown) {
      this.error = this.getUploadErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  private isPdfFile(file: File): boolean {
    const hasPdfMimeType = file.type === 'application/pdf';
    const hasPdfFileExtension = file.name.toLowerCase().endsWith('.pdf');

    return hasPdfMimeType || hasPdfFileExtension;
  }

  private getUploadErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = error.message;
      if (typeof message === 'string') {
        if (message.includes('Maximum number of documents')) {
          return `Maximal ${this.maxFiles} Dokumente pro Fall sind erlaubt.`;
        }
        if (message.includes('Total document size')) {
          return `Das Gesamtlimit von ${this.maxTotalSizeMb} MB pro Fall wurde überschritten.`;
        }
        return message;
      }
    }

    return 'Fehler beim Upload. Bitte versuche es erneut.';
  }

  private updateDocuments(
    documents: HwkDocumentUploadItem[],
    documentCount: number | null = documents.length
  ) {
    this.documents = documents;
    this.documentsChanged.emit(documentCount);
  }
}
