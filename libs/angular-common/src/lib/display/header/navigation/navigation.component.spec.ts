import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { NavigationComponent } from './navigation.component';

describe('NavigationComponent', () => {
  let spectator: Spectator<NavigationComponent>;
  const createComponent = createComponentFactory(NavigationComponent);

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
