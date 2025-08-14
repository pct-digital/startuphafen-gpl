import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { PctLoaderService } from './loader.service';

describe('LoaderService', () => {
  let spectator: SpectatorService<PctLoaderService>;
  const createService = createServiceFactory(PctLoaderService);

  beforeEach(() => (spectator = createService()));

  it('should be created', () => {
    expect(spectator.service).toBeTruthy();
  });

  it('is by default not loading', () => {
    expect(spectator.service.isLoading()).toBeFalsy();
  });

  it('can start a loader', () => {
    spectator.service.startLoading('X');
    expect(spectator.service.isLoading()).toBeTruthy();
  });

  it('can stop a loader', () => {
    spectator.service.startLoading('X');
    spectator.service.stopLoading('X');
    expect(spectator.service.isLoading()).toBeFalsy();
  });
});
