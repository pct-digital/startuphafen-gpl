import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  NavService,
  PopupService,
  ShButtonDirective,
  ShCardDirective,
  ShCardInnerDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
  ShInputDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import { ShProject, WebsiteText } from '@startuphafen/startuphafen-common';
import { Subject, takeUntil } from 'rxjs';
import { ProjectListComponent } from '../project-list/project-list.component';

export interface MainStartPageItems {
  projects: boolean;
  icon: string;
  label: string;
  buttonLabel: string;
  discription: string;
  path: string;
  action?: () => any;
}

@Component({
  selector: 'sh-start-page',
  standalone: true,
  imports: [
    CommonModule,
    ProjectListComponent,
    ShCardDirective,
    ShCardTitleDirective,
    ShCardSubtitleDirective,
    ShCardInnerDirective,
    ShInputDirective,
    ShButtonDirective,
    FormsModule,
  ],
  templateUrl: './start-page.component.html',
  styles: ``,
})
export class StartPageComponent implements OnDestroy, OnInit {
  private destroy$ = new Subject<void>();
  projectName = '';
  projects: ShProject[] = [];
  private projectToDeleteId: number | null = null;

  websiteText: WebsiteText[] = [];
  iconUrlRec: Record<string, string> = {};

  constructor(
    private router: Router,
    private nav: NavService,
    private popupService: PopupService,
    private trpc: TrpcService
  ) {}

  @ViewChild('projectPopupTemplate', { static: true })
  projectPopUpTemplate?: TemplateRef<any>;

  @ViewChild('createProjectPopup', { static: true })
  createProjectPopup?: TemplateRef<any>;

  @ViewChild('deleteProjectPopup', { static: true })
  deleteProjectPopup?: TemplateRef<any>;

  async ngOnInit() {
    this.projects = await this.getProjects();
    this.websiteText = await this.getWebsiteText([
      'startseite',
      'startKachel1',
      'startKachel2',
      'startKachel3',
      'startKachel4',
    ]);
    this.iconUrlRec = await this.mapUrls(this.websiteText);
  }

  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popupService
        .open(popupTemplate)
        .pipe(takeUntil(this.destroy$))
        .subscribe((action) => {
          console.log('popupAction', action);
        });
    }
  }

  async editProject(id: number) {
    await this.router.navigateByUrl(this.nav.applicationPage(id));
  }

  async deleteProject(id: number) {
    const project = this.projects.find((project) => project.id === id);
    if (!project?.gewASent && !project?.steErSent) {
      this.projectToDeleteId = id;
      this.openPopup(this.deleteProjectPopup);
    }
  }

  async confirmDeleteProject() {
    if (this.projectToDeleteId == null) return;
    this.projects = this.projects.filter(
      (project) => project.id !== this.projectToDeleteId
    );
    await this.trpc.client.ShProject.delete.mutate(this.projectToDeleteId);
    this.projectToDeleteId = null;
    this.popupService.closePopup();
  }

  async clickitem(item: MainStartPageItems) {
    await this.router.navigateByUrl(item.path);
  }

  getCardItems(): MainStartPageItems[] {
    return [
      {
        projects: false,
        icon:
          this.iconUrlRec['startKachel1'] == null
            ? ''
            : this.iconUrlRec['startKachel1'],
        label:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel1')
            ?.title ?? '',
        buttonLabel:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel1')
            ?.extraLabel ?? '',
        discription:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel1')
            ?.text ?? '',
        path: '',
        action: () => this.createProject(),
      },
      {
        projects: true,
        icon:
          this.iconUrlRec['startKachel2'] == null
            ? ''
            : this.iconUrlRec['startKachel2'],
        label:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel2')
            ?.title ?? '',
        buttonLabel:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel2')
            ?.extraLabel ?? '',
        discription:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel2')
            ?.text ?? '',
        path: this.nav.createProfilePage(),
      },
      {
        projects: false,
        icon:
          this.iconUrlRec['startKachel3'] == null
            ? ''
            : this.iconUrlRec['startKachel3'],
        label:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel3')
            ?.title ?? '',
        buttonLabel:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel3')
            ?.extraLabel ?? '',
        discription:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel3')
            ?.text ?? '',
        path: this.nav.contactPage(),
      },
      {
        projects: false,
        icon:
          this.iconUrlRec['startKachel4'] == null
            ? ''
            : this.iconUrlRec['startKachel4'],
        label:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel4')
            ?.title ?? '',
        buttonLabel:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel4')
            ?.extraLabel ?? '',
        discription:
          this.websiteText.find((wt) => wt.placeToPut === 'startKachel4')
            ?.text ?? '',
        path: this.nav.faqPage(),
      },
    ];
  }

  triggerAction(action: () => any) {
    return action();
  }

  createProject() {
    this.openPopup(this.createProjectPopup);
  }

  async saveProject() {
    const versionId = await this.trpc.client.CMS.questionVersionLoader.query(
      'EuN'
    );

    const id = await this.trpc.client.ShProject.create.mutate({
      name: this.projectName,
      progress: 0,
      gewASent: false,
      steErSent: false,
      versionId: versionId,
    });

    this.popupService.closePopup();

    await this.router.navigateByUrl(this.nav.applicationPage(id));
  }

  async getProjects() {
    return await this.trpc.client.ShProject.read.query();
  }

  closePopup() {
    this.popupService.closePopup();
  }

  async getWebsiteText(placeToPutList: string[]) {
    const websiteText = await this.trpc.client.CMS.getWebsiteText.query(
      placeToPutList
    );
    return websiteText;
  }

  async mapUrls(wText: WebsiteText[]) {
    const rec: Record<string, string> = {};

    for (const wt of wText) {
      if (wt.icon == null) continue;
      rec[wt.placeToPut] = await this.trpc.client.CMS.getFileUrl.query(
        wt.icon.url
      );
    }
    return rec;
  }

  getStartPageText() {
    return this.websiteText.find((text) => text.placeToPut === 'startseite');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
