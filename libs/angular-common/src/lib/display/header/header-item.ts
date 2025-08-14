/**
 * A real icon that can be clicked to navigate somewhere
 */
export interface HeaderLinkItem {
  id: number;
  type: 'HEADER_LINK_ITEM';
  icon: string;
  activeIcon: string;
  label: string;
  path: string;
  notificationCount?: number;
  isActive: boolean;
}

/**
 * This is an item that can be used at the parent level to show a collapsable group of items.
 * Clicking it does not trigger a navigation, hover on it on desktop is enough to open the collapsable
 * On mobile the user clicks this entry to unfold more entries
 */
export interface HeaderGroupItem {
  id: number;
  type: 'HEADER_GROUP_ITEM';
  icon: string;
  activeIcon: string;
  label: string;
  children: HeaderLinkItem[];
  groupId: string; // for tests, controls data-testid
  isActive: boolean;
}

export type HeaderNavigationItem = HeaderGroupItem | HeaderLinkItem;
