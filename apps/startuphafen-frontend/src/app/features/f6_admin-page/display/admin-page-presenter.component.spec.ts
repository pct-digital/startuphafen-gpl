import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { AdminPagePresenterComponent } from './admin-page-presenter.component';

describe('AdminPagePresenterComponent', () => {
  let spectator: Spectator<AdminPagePresenterComponent>;
  const createComponent = createComponentFactory(AdminPagePresenterComponent);

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
