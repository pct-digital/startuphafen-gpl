import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CHECKLIST_DOCUMENTS,
  ProjectWithDocs,
} from '@startuphafen/startuphafen-common';
import {
  Document,
  DocumentEditingState,
} from '../../container/profile-page/profile-page.component';
import { ProfileHwkApplicationStatus } from '../../services/profile-form-state/profile-state.service';

@Component({
  selector: 'sh-profile-content-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-content-display.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class ProfileContentDisplayComponent {
  @Input() projects: ProjectWithDocs[] = [];
  @Input() gewaProjects: number[] | null = null;
  @Input() hwkApplicationProjectsStatus: ProfileHwkApplicationStatus[] = [];
  @Output() documentRequested = new EventEmitter<{
    projectId: number;
    docId: number;
  }>();
  @Output() hwkApplicationRequested = new EventEmitter<number>();
  @Input() documentEditing!: DocumentEditingState;
  @Output() documentsShowToggled = new EventEmitter<number>();

  async requestDocument(projectId: number, docId: number) {
    this.documentRequested.emit({ projectId, docId });
  }

  requestHwkApplication(projectId: number) {
    this.hwkApplicationRequested.emit(projectId);
  }

  hasHwkApplication(projectId: number): boolean {
    return this.hwkApplicationProjectsStatus.some(
      (hwk) => hwk.id === projectId
    );
  }

  hwkApplicationSent(projectId: number): boolean {
    return this.hwkApplicationProjectsStatus.some(
      (hwk) => hwk.id == projectId && hwk.mailStatus === 'sent'
    );
  }

  cleanDocumentName(document: Document): string {
    switch (document.filename) {
      case CHECKLIST_DOCUMENTS.GS_CONTRACT:
        return 'Gesellschaftsvertrag';
      case CHECKLIST_DOCUMENTS.SH_CONTRACT:
        return 'Vertrag zwischen Gesellschaft und Gesellschafter';
      case CHECKLIST_DOCUMENTS.HR_EXTRACT:
        return 'Handelsregisterauszug';
      default:
        return document.filename;
    }
  }

  getDocuments(project: ProjectWithDocs): Document[] {
    return this.documentEditing.documents.get(project.id) ?? [];
  }

  showDocuments(project: ProjectWithDocs): boolean {
    return this.documentEditing.show.get(project.id) ?? false;
  }

  hasRelevantDocuments(project: ProjectWithDocs): boolean {
    return this.getDocuments(project).length > 0;
  }

  toggleShowDocuments(projectId: number) {
    this.documentsShowToggled.emit(projectId);
  }

}
