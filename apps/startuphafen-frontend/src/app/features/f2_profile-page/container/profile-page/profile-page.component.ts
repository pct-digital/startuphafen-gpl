import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {
  FeatureFlagsService,
  PopupService,
  ShButtonDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import {
  ProfileInfo,
  ProjectWithDocs,
  ShUser,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { Subject, takeUntil } from 'rxjs';
import { ProfileContentDisplayComponent } from '../../display/profile-content-display/profile-content-display.component';
import { ProfileHeaderDisplayComponent } from '../../display/profile-header-display/profile-header-display.component';
import {
  ProfileHwkApplicationStatus,
  ProfileStateService,
} from '../../services/profile-form-state/profile-state.service';

export type Document = Omit<UserDocument, 'data' | 'userId'>;

export interface DocumentEditingState {
  documents: Map<number, Document[]>;
  show: Map<number, boolean>;
  error: Map<number, string | null>;
}

@Component({
  selector: 'sh-profile-container',
  standalone: true,
  imports: [
    CommonModule,
    NgxExtendedPdfViewerModule,
    ProfileHeaderDisplayComponent,
    ProfileContentDisplayComponent,
    ShButtonDirective,
  ],
  templateUrl: './profile-page.component.html',
  styles: ``,
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  private profileStateService = inject(ProfileStateService);
  private popupService = inject(PopupService);
  private featureFlags = inject(FeatureFlagsService);
  private documentRequestVersion = 0;
  private destroy$ = new Subject<void>();
  private trpc = inject(TrpcService);

  @ViewChild('pdfPopupTemplate', { static: true })
  pdfPopupTemplate?: TemplateRef<unknown>;

  profile: Partial<ShUser> = {};
  profileInfo: Partial<ProfileInfo> = {};
  projects: ProjectWithDocs[] = [];
  gewaProjects: number[] = [];
  hwkApplicationProjectsStatus: ProfileHwkApplicationStatus[] = [];
  loadedDocument: Uint8Array | null = null;
  isDocumentLoading = false;
  documentLoadError: string | null = null;

  documentEditing: DocumentEditingState = {
    documents: new Map(),
    show: new Map(),
    error: new Map(),
  };

  async ngOnInit() {
    this.profile = await this.profileStateService.getUser();
    this.profileInfo = await this.profileStateService.getProfileInfo();
    this.projects = await this.profileStateService.getProjects();

    await Promise.all(
      this.projects.map(async (project) => {
        const documents =
          await this.trpc.client.UserDocuments.listByProject.query({
            projectId: project.id,
          });
        this.documentEditing.show.set(project.id, false);
        this.documentEditing.error.set(project.id, null);
        this.documentEditing.documents.set(project.id, documents);
      })
    );

    this.gewaProjects = await this.profileStateService.updateGewaProjects(
      this.projects
    );
    this.hwkApplicationProjectsStatus = this.featureFlags.isEnabled('hwk')
      ? await this.profileStateService.getHwkApplicationProjectsStatus(
          this.projects
        )
      : [];
  }

  async openProjectDocument(input: { projectId: number; docId: number }) {
    await this.openPdfDocument(() =>
      this.profileStateService.getProjectDocumentData(
        input.projectId,
        input.docId
      )
    );
  }

  async openHwkApplication(projectId: number) {
    await this.openPdfDocument(() =>
      this.profileStateService.getHwkApplicationPdf(projectId)
    );
  }

  private async openPdfDocument(loader: () => Promise<{ data: Uint8Array }>) {
    const requestVersion = ++this.documentRequestVersion;
    this.loadedDocument = null;
    this.documentLoadError = null;
    this.isDocumentLoading = true;

    if (this.pdfPopupTemplate != null) {
      this.popupService.closePopup();
      this.popupService
        .open(this.pdfPopupTemplate, {
          width: 85,
          height: 85,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }

    try {
      const result = await loader();

      if (requestVersion !== this.documentRequestVersion) {
        return;
      }

      this.loadedDocument = result.data;
    } catch {
      if (requestVersion !== this.documentRequestVersion) {
        return;
      }

      this.documentLoadError = 'Das Dokument konnte nicht geladen werden.';
    } finally {
      if (requestVersion === this.documentRequestVersion) {
        this.isDocumentLoading = false;
      }
    }
  }

  closeDocumentPopup() {
    this.documentRequestVersion += 1;
    this.loadedDocument = null;
    this.isDocumentLoading = false;
    this.documentLoadError = null;
    this.popupService.closePopup();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleShowDocuments(projectId: number) {
    const state = this.documentEditing.show.get(projectId);
    if (state === undefined) return;
    this.documentEditing.show.set(projectId, !state);
  }

}
