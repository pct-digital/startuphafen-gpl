import { Spectator, createComponentFactory } from '@ngneat/spectator';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let spectator: Spectator<HeaderComponent>;
  const createComponent = createComponentFactory(HeaderComponent);

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
