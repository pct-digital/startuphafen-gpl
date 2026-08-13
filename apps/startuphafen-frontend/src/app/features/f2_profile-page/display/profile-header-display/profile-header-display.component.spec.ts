import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { ProfileHeaderDisplayComponent } from './profile-header-display.component';

describe('ProfileHeaderDisplayComponent', () => {
  let spectator: Spectator<ProfileHeaderDisplayComponent>;
  const createComponent = createComponentFactory({
    component: ProfileHeaderDisplayComponent,
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('should display profile data when provided', () => {
    const mockProfile = {
      name: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '123456789',
      cellPhoneNumber: '0987654321',
      country: 'Germany',
      postalCode: '12345',
      city: 'Berlin',
      street: 'Main Street 1',
      dateOfBirth: '1990-01-01',
      title: 'Dr.',
      academicTitle: 'Prof.',
    };

    spectator = createComponent({
      props: {
        profile: mockProfile,
      },
    });

    expect(spectator.component.profile).toEqual(mockProfile);
    expect(spectator.query('[data-testid="profile-header"]')).toBeTruthy();
    expect(spectator.query('[data-testid="profile-image"]')).toBeTruthy();
  });

  it('should handle empty profile', () => {
    spectator = createComponent();
    expect(spectator.component.profile).toEqual({});
  });
});
