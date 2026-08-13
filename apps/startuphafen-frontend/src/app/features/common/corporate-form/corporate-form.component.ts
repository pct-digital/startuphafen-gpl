import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FeatureFlagsService,
  NavService,
  ShCardDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import { BusinessTakeoverHintComponent } from '../../f3-application-page/questions/common/business-takeover-hint/business-takeover-hint.component';
import { ProfileInfoComponent } from '../profile-info/profile-info.component';

@Component({
  selector: 'sh-corporate-form',
  standalone: true,
  imports: [
    CommonModule,
    ShCardDirective,
    BusinessTakeoverHintComponent,
    ProfileInfoComponent,
  ],
  templateUrl: './corporate-form.component.html',
  styles: ``,
})
export class CorporateFormComponent implements OnInit {
  projectId = -1;
  profileInfoDone = false;

  constructor(
    private router: Router,
    private nav: NavService,
    private activatedRoute: ActivatedRoute,
    private trpc: TrpcService,
    private featureFlags: FeatureFlagsService
  ) {}

  getRouteParams(param: string) {
    const paramMap = this.activatedRoute.snapshot.paramMap;
    return paramMap.get(param) ?? null;
  }

  ngOnInit(): void {
    this.projectId = Number(this.getRouteParams('projectId') ?? -1);
  }

  async einzelunternehmer(id: number) {
    await this.trpc.client.Project.update.mutate({
      id: id,
      updates: { catalogueId: 'eun' },
    });
    await this.router.navigateByUrl(this.nav.questionnaire('eun', id));
  }

  async ugGmbh(id: number) {
    await this.trpc.client.Project.update.mutate({
      id: id,
      updates: { catalogueId: 'kapg' },
    });
    await this.router.navigateByUrl(this.nav.checkListPage(id));
  }

  isEUnEnabled() {
    return this.featureFlags.isEnabled('eu_questionflow');
  }
  isUGEnabled() {
    return this.featureFlags.isEnabled('ug_questionflow');
  }
}
