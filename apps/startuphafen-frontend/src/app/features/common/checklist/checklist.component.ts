import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FeatureFlagsService,
  NavService,
  PctLoaderService,
  ShButtonDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import { DocumentUploadComponent } from '../document-upload-step/document-upload.component';

interface ChecklistItem {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

@Component({
  selector: 'sh-checklist',
  standalone: true,
  imports: [CommonModule, ShButtonDirective, DocumentUploadComponent],
  templateUrl: './checklist.component.html',
  animations: [
    trigger('slideTransition', [
      transition(':leave', [
        style({ transform: 'translateX(0)', opacity: 1 }),
        animate(
          '150ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ opacity: 0.3 })
        ),
        animate(
          '300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ transform: 'translateX(-50%)', opacity: 0 })
        ),
      ]),
      transition(':enter', [
        style({ transform: 'translateX(50%)', opacity: 0 }),
        animate(
          '150ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ opacity: 0.3 })
        ),
        animate(
          '350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ transform: 'translateX(0)', opacity: 1 })
        ),
      ]),
    ]),
  ],
  styles: [
    `
      :host {
        display: block;
        overflow-x: hidden;
      }
    `,
  ],
})
export class ChecklistComponent implements OnInit {
  @ViewChild('uploadDocuments') uploadDocuments?: DocumentUploadComponent;
  featureFlags = inject(FeatureFlagsService);

  checklistItems: ChecklistItem[] = [];
  currentStepIndex = 0;
  title = 'Meine Checkliste';
  description =
    'Hier hast Du einen Überblick, was Du für die Gründung brauchst.';
  uploadReady = false;
  isUploading = false;
  projectId = -1;
  progress: number | undefined = undefined;

  isAnimating = false;
  showChecklist = true;

  bntk = {
    sent: false,
    sending: false,
    unsuccessfulSend: false,
    domain: '',
  };

  constructor(
    private router: Router,
    private nav: NavService,
    private activatedRoute: ActivatedRoute,
    private loaderService: PctLoaderService,
    private trpc: TrpcService
  ) {}

  getRouteParams(param: string) {
    const paramMap = this.activatedRoute.snapshot.paramMap;
    return paramMap.get(param) ?? null;
  }

  async ngOnInit() {
    this.initializeChecklist();
    await this.loaderService.doWhileLoading(
      'ChecklistComponent:ngOnInit',
      async () => {
        this.projectId = Number(this.getRouteParams('projectId') ?? -1);
        const projectProgress =
          await this.trpc.client.Project.pickFiltered.query({
            filters: { id: this.projectId },
            pick: ['progress'],
          });
        if (projectProgress.length !== 0) {
          this.progress = projectProgress[0].progress;
        }
        if (this.isBntkEnabled()) {
          try {
            this.bntk.domain = (
              await this.trpc.client.BNTK.getBntkDomain.query()
            ).domain;
          } catch {
            this.bntk.domain = '';
          }
        }
      }
    );
  }

  private initializeChecklist() {
    this.checklistItems = [
      {
        id: 1,
        title: 'Notarielle Gründung',
        description:
          'Du hast schon notariell gegründet und Dir liegen alle Unterlagen wie Gesellschaftsvertrag und Handelsregisterauszug vor? Dann klick auf Weiter. Du suchst noch einen Notar? Dann erledige das jetzt über online.notar. Wenn Dir dann die Unterlagen vorliegen, kannst Du bei startuphafen.sh weitermachen.',
        completed: false,
      },
      {
        id: 2,
        title: 'Dokumente hochladen',
        description:
          'Lade hier Deinen Gesellschaftsvertrag und den Vertrag zwischen Gesellschaft und Gesellschafter(n) hoch.',
        completed: false,
      },
      {
        id: 3,
        title: 'Steuerliche Erfassung und Gewerbeanmeldung',
        description:
          'Melde Dein Gewerbe an und kümmere Dich um die steuerliche Erfassung bei den Behörden.',
        completed: false,
      },
    ];
  }

  async handleItemClick(index: number) {
    if (this.isAnimating) {
      return;
    }

    if (
      index === 1 &&
      this.checklistPreviouslyCompleted &&
      !this.documentChanges()
    ) {
      await this.router.navigateByUrl(
        this.nav.questionnaire('kapg', this.projectId)
      );
    }

    if (index === 1 && this.isStepCurrent(index) && this.uploadDocuments) {
      try {
        await this.loaderService.doWhileLoading(
          'Checklist.uploadDocuments',
          async () => {
            this.isUploading = true;
            try {
              await this.uploadDocuments!.uploadFiles();
              this.currentStepIndex++;
            } finally {
              this.isUploading = false;
            }
          }
        );
      } catch {
        // Upload error is already displayed by DocumentUploadComponent.
        // Do not advance to the next step.
        return;
      }
    } else if (
      index === this.currentStepIndex &&
      this.currentStepIndex < this.checklistItems.length
    ) {
      this.currentStepIndex++;
    }

    if (
      this.currentStepIndex >= this.checklistItems.length &&
      !this.checklistPreviouslyCompleted
    ) {
      this.isAnimating = true;
      this.showChecklist = false;

      await this.setProjectProgress();
      setTimeout(async () => {
        await this.router.navigateByUrl(
          this.nav.questionnaire('kapg', this.projectId)
        );
        this.isAnimating = false;
      }, 500);
    }
  }

  async setProjectProgress() {
    if (this.checklistPreviouslyCompleted) return;
    await this.trpc.client.Project.update.mutate({
      id: this.projectId,
      updates: { progress: 1 },
    });
  }

  onFileSelected(isValid: boolean) {
    if (!this.checklistPreviouslyCompleted) return;
    this.uploadReady = isValid;
  }

  onUploadCompletion(isComplete: boolean) {
    if (this.checklistPreviouslyCompleted) return;
    this.uploadReady = isComplete;
  }

  isStepCompleted(index: number) {
    if (this.checklistPreviouslyCompleted) {
      return index !== 1;
    }
    return index < this.currentStepIndex;
  }

  isStepCurrent(index: number) {
    if (this.checklistPreviouslyCompleted) {
      return index === 1;
    }

    return index === this.currentStepIndex;
  }

  isStepClickable(index: number) {
    if (this.checklistPreviouslyCompleted) {
      return index === 1;
    }

    if (index === 1 && !this.isStepCompleted(index)) {
      return this.uploadReady;
    }

    return index === this.currentStepIndex || index < this.currentStepIndex;
  }

  openNotar(index: number) {
    if (index === 0 && this.isStepCurrent(index)) {
      const notarWindow = window.open(
        'https://online.notar.de/',
        '_blank',
        'noopener noreferrer'
      );
      if (notarWindow) {
        notarWindow.focus();
      }
    }
  }

  async sendToBntk(index: number) {
    if (!(index === 0 && this.isStepCurrent(index))) return;
    this.bntk.sending = true;
    this.bntk.unsuccessfulSend = false;
    try {
      const res = await this.trpc.client.BNTK.sendToBntk.query({
        projectId: this.projectId,
      });
      if (res.success) {
        this.bntk.sent = true;
        const notarWindow = window.open(
          `${this.bntk.domain}/ov/registrierung/${res.sdsId}/`,
          '_blank',
          'noopener noreferrer'
        );

        if (notarWindow) notarWindow.focus();
      } else {
        this.bntk.unsuccessfulSend = true;
      }
    } catch {
      this.bntk.unsuccessfulSend = true;
    }
    this.bntk.sending = false;
  }

  documentChanges(): boolean {
    return (
      this.uploadDocuments?.hrgFile !== null ||
      this.uploadDocuments?.contractFile !== null ||
      this.uploadDocuments?.shareholderFile !== null
    );
  }

  getButtonText(index: number) {
    if (this.isStepCompleted(index)) {
      return 'Fertig';
    }
    if (this.isStepCurrent(index)) {
      if (index === 1) {
        if (this.checklistPreviouslyCompleted && !this.documentChanges())
          return 'Weiter';
        return 'Hochladen';
      }
      if (index === 0) {
        return 'Weiter';
      }

      return 'Weiter';
    }
    return 'Gesperrt';
  }

  getProgressPercentage() {
    if (this.checklistPreviouslyCompleted) {
      return 100;
    }
    if (this.checklistItems.length === 0) {
      return 0;
    }
    return Math.round(
      (this.currentStepIndex / this.checklistItems.length) * 100
    );
  }

  isBntkEnabled(): boolean {
    return this.featureFlags.isEnabled('bntk');
  }

  get checklistPreviouslyCompleted(): boolean {
    if (this.progress === undefined) return false;
    return this.progress > 0;
  }
}
