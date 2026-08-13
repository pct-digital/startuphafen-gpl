import { DOCUMENT } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LoaderComponent,
  NavService,
  PctLoaderService,
  TrpcService,
} from '@startuphafen/angular-common';
import { AgChartOptions } from 'ag-charts-community';
import { KeycloakService } from 'keycloak-angular';
import { AdminPagePresenterComponent } from '../display/admin-page-presenter.component';

@Component({
  selector: 'sh-admin-page-container',
  standalone: true,
  imports: [AdminPagePresenterComponent, LoaderComponent],
  templateUrl: './admin-page-container.component.html',
  styles: ``,
})
export class AdminPageContainerComponent implements OnInit {
  roles: string[] = [];
  topCards: { title: string; iconUrl: string; value: number | string }[] = [];
  userChartOptions: AgChartOptions | null = null;
  errorMessage: string | null = null;
  private nav = inject(NavService);
  private router = inject(Router);
  constructor(
    private keycloak: KeycloakService,
    private trpc: TrpcService,
    private activeRoute: ActivatedRoute,
    private loadingService: PctLoaderService
  ) {}
  private readonly document = inject(DOCUMENT);
  getRoles() {
    this.roles = this.keycloak.getUserRoles();
  }
  async ngOnInit() {
    await this.loadingService.doWhileLoading('adminPageInit', async () => {
      this.getRoles();
      const isAdmin = this.roles.includes('startuphafen-admin');
      if (!isAdmin) {
        this.topCards = [];
        this.userChartOptions = null;
        return;
      }
      try {
        this.topCards = await this.getTopCards();
        await this.createUserChart();
      } catch (err) {
        console.error('Failed to load admin data', err);
        this.userChartOptions = null;
        this.errorMessage =
          'Es ist ein Problem während des Ladens der Benutzer Daten entstanden, bitte versuchen Sie es später erneut.';
      }
    });
  }
  async getTopCards() {
    const userCount = await this.trpc.client.User.getUserCount.query();
    const projectCount = await this.trpc.client.Project.getProjectCount.query();
    return [
      {
        title: 'Gesamte Nutzer',
        iconUrl: '/assets/icons/thin/users-sharp-thin.svg',
        value: userCount,
      },
      {
        title: 'Erstellte Projekte',
        iconUrl: '/assets/icons/thin/file-sharp-thin.svg',
        value: projectCount,
      },
    ];
  }

  routeToKC() {
    const currentRoute = this.activeRoute.snapshot.routeConfig?.path;
    if (!currentRoute) return;
    const url = this.document.location.href;
    const kcUrl = url.replace(currentRoute, 'kc-admin');
    window.location.href = kcUrl;
  }

  async routeStrapi() {
    window.location.href = await this.trpc.client.Ext.getStrapiUrl.query();
  }

  async routeToFeatureFlags() {
    await this.router.navigate([this.nav.featureFlagsAdminPage()]);
  }


  async createUserChart() {
    const data = await this.trpc.client.User.getUserCreatedRatio.query();
    this.userChartOptions = {
      data: data,
      series: [{ type: 'bar', xKey: 'createdAt', yKey: 'amount' }],
    };
  }
}
