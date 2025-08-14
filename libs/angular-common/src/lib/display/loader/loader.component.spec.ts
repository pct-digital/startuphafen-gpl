import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  let spectator: Spectator<LoaderComponent>;
  const createComponent = createComponentFactory(LoaderComponent);

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
