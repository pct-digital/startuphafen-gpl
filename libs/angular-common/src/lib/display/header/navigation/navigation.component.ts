import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HeaderLinkItem, HeaderNavigationItem } from '../header-item';

@Component({
  selector: 'sh-navigation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navigation.component.html',
  styles: `
    ul {
      list-style-type: none;
      margin: 0;
    }
  `,
})
export class NavigationComponent {
  @Input() activeRootUrlSegment = '';

  @Input() items: HeaderNavigationItem[] = [];
  @Output() navigationClick = new EventEmitter<HeaderLinkItem>();

  onItemClick(item: HeaderNavigationItem): void {
    if (item.type === 'HEADER_LINK_ITEM') {
      this.navigationClick.emit(item);
    }
  }

  onSubitemClick(item: HeaderLinkItem) {
    this.navigationClick.emit(item);
  }

  isActive(item: HeaderNavigationItem) {
    if (item.type === 'HEADER_LINK_ITEM') {
      return item.path.startsWith('/' + this.activeRootUrlSegment);
    } else {
      for (const child of item.children) {
        if (this.isActive(child)) {
          return true;
        }
      }
      return false;
    }
  }
}
