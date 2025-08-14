import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  HeaderComponent,
  HeaderLinkItem,
  HeaderNavigationItem,
  NavService,
  PopupService,
  ShButtonDirective,
  ShCardDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
} from '@startuphafen/angular-common';
import { KeycloakService } from 'keycloak-angular';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'sh-portal-header',
  standalone: true,
  imports: [
    HeaderComponent,
    ShCardDirective,
    ShCardSubtitleDirective,
    ShCardTitleDirective,
    ShButtonDirective,
  ],
  templateUrl: './portal-header.component.html',
  styles: ``,
})
export class PortalHeaderComponent implements OnInit {
  private destroy$ = new Subject<void>();

  isLoggedIn = false;

  @ViewChild('LogoutNotice', { static: true })
  logoutNoticeTemplate?: TemplateRef<any>;

  constructor(
    private nav: NavService,
    private router: Router,
    private keycloak: KeycloakService,
    private popup: PopupService
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoggedIn = this.keycloak.isLoggedIn();
  }

  async onNavigation(link: HeaderLinkItem) {
    if (link.path.startsWith('https://')) {
      window.open(link.path, '_blank');
    } else if (link.path.startsWith('/logout')) {
      await this.logout();
    } else {
      await this.router.navigateByUrl(link.path);
      this.getRootPath();
    }
  }

  getRootPath() {
    // based on the "root assumption": All subparts of the app are located under some common root-url-segment
    const segments = this.router.url.split('/');
    const root = segments.find((x) => x.trim().length > 0);
    return root ?? '';
  }

  getItems(): HeaderNavigationItem[] {
    const items: HeaderNavigationItem[] = [
      {
        id: 1,
        type: 'HEADER_LINK_ITEM',
        label: 'Übersicht',
        path: this.nav.home(),
        icon: '/assets/icons/thin/browser-sharp-thin.svg',
        activeIcon: '/assets/icons/solid/browser-sharp-solid.svg',
        isActive: this.isLoggedIn,
      },
      {
        id: 2,
        type: 'HEADER_LINK_ITEM',
        label: 'Kontakte',
        path: this.nav.contactPage(),
        icon: '/assets/icons/thin/users-sharp-thin.svg',
        activeIcon: '/assets/icons/solid/users-sharp-solid.svg',
        isActive: this.isLoggedIn,
      },
      {
        id: 3,
        type: 'HEADER_LINK_ITEM',
        label: 'FAQ / Wissen',
        path: this.nav.faqPage(),
        icon: '/assets/icons/thin/square-question-sharp-thin.svg',
        activeIcon: '/assets/icons/solid/square-question-sharp-solid.svg',
        isActive: this.isLoggedIn,
      },
      {
        id: 3,
        type: 'HEADER_LINK_ITEM',
        label: 'Mein Profil',
        path: this.nav.profilePage(),
        icon: '/assets/icons/thin/user-sharp-thin.svg',
        activeIcon: '/assets/icons/solid/user-sharp-solid.svg',
        isActive: this.isLoggedIn,
      },
    ];

    return items;
  }

  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popup
        .open(popupTemplate)
        .pipe(takeUntil(this.destroy$))
        .subscribe((action) => {
          console.log('popupAction', action);
        });
    }
  }

  async logout() {
    this.openPopup(this.logoutNoticeTemplate);
  }

  async login() {
    await this.keycloak.login();
  }

  async close() {
    this.popup.closePopup();
    await this.keycloak.logout(window.location.origin + this.nav.home());
  }
}
