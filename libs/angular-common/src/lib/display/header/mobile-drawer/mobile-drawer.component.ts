import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HeaderLinkItem, HeaderNavigationItem } from '../header-item';

@Component({
  selector: 'sh-mobile-drawer',
  standalone: true,
  imports: [CommonModule],
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
  templateUrl: './mobile-drawer.component.html',
  styles: `
    ul {
      list-style-type: none;
    }`,
})
export class MobileDrawerComponent {
  @Input() items: HeaderNavigationItem[] = [];
  @Output() navigationClick = new EventEmitter<HeaderLinkItem>();
  @Output() loginClick = new EventEmitter<void>();
  @Output() logoutClick = new EventEmitter<void>();
  @Input() hasLogin = false;

  collapsedItem: HeaderNavigationItem | null = null;
  onCollapse(item: HeaderNavigationItem): void {
    if (
      (this.collapsedItem && this.collapsedItem.id !== item.id) ||
      !this.collapsedItem
    ) {
      this.collapsedItem = item;
    } else {
      this.collapsedItem = null;
    }

    if (item.type === 'HEADER_LINK_ITEM') {
      this.navigationClick.emit(item);
    }
  }

  onClickSubitem(item: HeaderLinkItem) {
    this.navigationClick.emit(item);
  }

  onLoginClick(): void {
    this.loginClick.emit();
  }

  onLogoutClick(): void {
    this.logoutClick.emit();
  }
}
