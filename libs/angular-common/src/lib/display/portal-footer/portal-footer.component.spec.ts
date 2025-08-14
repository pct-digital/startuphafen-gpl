import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { PortalFooterComponent } from './portal-footer.component';

describe('PortalFooterComponent', () => {
  let spectator: Spectator<PortalFooterComponent>;
  const createComponent = createComponentFactory(PortalFooterComponent);

  it('should create', () => {
    spectator = createComponent({});

    expect(spectator.component).toBeTruthy();
  });
});
