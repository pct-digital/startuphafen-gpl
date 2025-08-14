import { createServiceFactory, SpectatorService } from '@ngneat/spectator';
import { PopupService } from './popup.service';

describe('PopupService', () => {
  let spectator: SpectatorService<PopupService>;
  const createService = createServiceFactory(PopupService);

  beforeEach(() => (spectator = createService()));

  it('should...', () => {
    expect(spectator.service).toBeTruthy();
  });
});
