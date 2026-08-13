import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { smoothScrollUnlessFirefox } from '../../helpers/helpers';
import { HeaderLinkItem, HeaderNavigationItem } from './header-item';
import { MobileDrawerComponent } from './mobile-drawer/mobile-drawer.component';
import { NavigationComponent } from './navigation/navigation.component';

@Component({
  selector: 'sh-header',
  standalone: true,
  imports: [NavigationComponent, CommonModule, MobileDrawerComponent],
  animations: [
    trigger('fadeInOut', [
      state(
        'void',
        style({
          opacity: 0,
        })
      ),
      transition(':enter, :leave', [animate(200)]),
    ]),
  ],
  templateUrl: './header.component.html',
  styles: `
    ul {
      list-style-type: none;
      margin: 0;
    }
  `,
})
export class HeaderComponent {
  @Input() hasLogin = false;

  @Input() activeRootUrlSegment = '';

  constructor(private router: Router) {}

  @Input() items: HeaderNavigationItem[] = [];
  @Output() navigationClick = new EventEmitter<HeaderLinkItem>();
  showMobileDrawer = false;

  @Output() loginClick = new EventEmitter<void>();
  @Output() logoutClick = new EventEmitter<void>();

  onClickNavigation(link: HeaderLinkItem) {
    smoothScrollUnlessFirefox(-1, 0);
    this.navigationClick.emit(link);
    this.showMobileDrawer = false;
  }
  async onLogoClick() {
    smoothScrollUnlessFirefox(-1, 0);
    await this.router.navigateByUrl('/start');
  }
}
