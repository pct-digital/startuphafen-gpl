import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { ProfileStateService } from '../../services/profile-form-state/profile-state.service';
import { ProfilePageComponent } from './profile-page.component';

describe('ProfilePageComponent', () => {
  let spectator: Spectator<ProfilePageComponent>;
  const createComponent = createComponentFactory({
    component: ProfilePageComponent,
    mocks: [ProfileStateService],
  });

  it('should initialize profile and projects on ngOnInit', async () => {
    spectator = createComponent();
    const profileStateService = spectator.inject(ProfileStateService);

    const mockProfile = { firstName: 'John', lastName: 'Doe' };
    const mockProjects = [
      {
        id: 1,
        name: 'test',
        gewASent: true,
        progress: 100,
        steErSent: true,
        userId: 'testUserId',
      },
    ];
    const mockDescription = 'Project description';

    jest.spyOn(profileStateService, 'getUser').mockResolvedValue(mockProfile);
    jest
      .spyOn(profileStateService, 'getProjects')
      .mockResolvedValue(mockProjects);
    jest
      .spyOn(profileStateService, 'getProjectDescription')
      .mockResolvedValue(mockDescription);

    await spectator.component.ngOnInit();

    expect(spectator.component.profile).toEqual(mockProfile);
    expect(spectator.component.projectsUnaltered).toEqual(mockProjects);
    expect(spectator.component.projects[0].description).toEqual(
      mockDescription
    );
  });
});
