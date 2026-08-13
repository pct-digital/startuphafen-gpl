import { ReactiveFormsModule } from '@angular/forms';
import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldInputComponent,
  FormlyFieldProfileInputComponent,
  PctLoaderService,
} from '@startuphafen/angular-common';
import { KeycloakService } from 'keycloak-angular';
import { ProfileInfoComponent } from './profile-info.component';
import { ProfileInfoService } from './profile-info.service';

describe('ProfileInfoComponent', () => {
  let spectator: Spectator<ProfileInfoComponent>;
  const mockProfileInfoService = {
    create: jest.fn(),
    get: jest.fn(),
  };

  const mockLoaderService = {
    doWhileLoading: jest.fn((_key: string, work: () => Promise<any>) => work()),
  };

  const createComponent = createComponentFactory({
    component: ProfileInfoComponent,
    imports: [
      ReactiveFormsModule,
      FormlyModule.forRoot({
        types: [
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'profile-input',
            component: FormlyFieldProfileInputComponent,
          },
        ],
      }),
    ],
    mocks: [KeycloakService],
    providers: [
      { provide: ProfileInfoService, useValue: mockProfileInfoService },
      { provide: PctLoaderService, useValue: mockLoaderService },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileInfoService.get.mockResolvedValue(null);
    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should render formly form', () => {
    expect(spectator.query(byTestId('profile-form'))).toExist();
    expect(spectator.query(byTestId('profile-save-btn'))).toExist();
  });

  it('should have +49 as default international code', () => {
    expect(spectator.component.model.phoneInternational).toBe('+49');
  });

  it('should disable save button when form is invalid', () => {
    const saveBtn = spectator.query(
      byTestId('profile-save-btn')
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('should enable save button when form is valid', async () => {
    await spectator.component.ngOnInit();

    spectator.component.model.phoneNational = '30';
    spectator.component.model.phoneNumber = '12345678';
    spectator.component.model.birthCountry = 'Germany';
    spectator.component.model.birthPlace = 'Berlin';

    spectator.component.form.get('phoneNational')?.setValue('30');
    spectator.component.form.get('phoneNumber')?.setValue('12345678');
    spectator.component.form.get('birthCountry')?.setValue('Germany');
    spectator.component.form.get('birthPlace')?.setValue('Berlin');
    spectator.detectChanges();

    expect(spectator.component.isFormValid).toBe(true);
  });

  it('should call service create on save', async () => {
    mockProfileInfoService.create.mockResolvedValue(undefined);
    await spectator.component.ngOnInit();

    spectator.component.model.phoneNational = '30';
    spectator.component.model.phoneNumber = '12345678';
    spectator.component.model.website = 'https://example.com';
    spectator.component.model.birthCountry = 'Germany';
    spectator.component.model.birthPlace = 'Berlin';

    spectator.component.form.get('phoneNational')?.setValue('30');
    spectator.component.form.get('phoneNumber')?.setValue('12345678');
    spectator.component.form.get('birthCountry')?.setValue('Germany');
    spectator.component.form.get('birthPlace')?.setValue('Berlin');

    let emitted = false;
    spectator.component.profileSaved.subscribe(() => {
      emitted = true;
    });

    await spectator.component.saveProfile();

    expect(mockProfileInfoService.create).toHaveBeenCalledWith({
      phoneInternational: '+49',
      phoneNational: '30',
      phoneNumber: '12345678',
      website: 'https://example.com',
      birthCountry: 'Germany',
      birthPlace: 'Berlin',
    });
    expect(emitted).toBe(true);
  });

  it('should show error on save failure', async () => {
    mockProfileInfoService.create.mockRejectedValue(new Error('Network error'));
    await spectator.component.ngOnInit();

    spectator.component.model.phoneNational = '30';
    spectator.component.model.phoneNumber = '12345678';
    spectator.component.model.birthCountry = 'Germany';
    spectator.component.model.birthPlace = 'Berlin';

    spectator.component.form.get('phoneNational')?.setValue('30');
    spectator.component.form.get('phoneNumber')?.setValue('12345678');
    spectator.component.form.get('birthCountry')?.setValue('Germany');
    spectator.component.form.get('birthPlace')?.setValue('Berlin');

    await spectator.component.saveProfile();
    spectator.detectChanges();

    expect(spectator.component.error).toBe(
      'Fehler beim Speichern. Bitte versuche es erneut.'
    );
    expect(spectator.query(byTestId('profile-error'))).toExist();
  });

  it('should prefill model from existing profile info', async () => {
    mockProfileInfoService.get.mockResolvedValue({
      phoneInternational: undefined,
      phoneNational: '31',
      phoneNumber: '87654321',
      website: 'https://example.org',
    });

    await spectator.component.ngOnInit();

    expect(spectator.component.model).toEqual({
      phoneInternational: '+49',
      phoneNational: '31',
      phoneNumber: '87654321',
      website: 'https://example.org',
      birthCountry: '',
      birthPlace: '',
    });
  });

  it('should retain default international code when not provided', async () => {
    mockProfileInfoService.get.mockResolvedValue({
      phoneInternational: undefined,
      phoneNational: '40',
      phoneNumber: '99988877',
      website: null,
    } as any);

    await spectator.component.ngOnInit();

    expect(spectator.component.model.phoneInternational).toBe('+49');
  });

  describe('form validity', () => {
    beforeEach(() => {
      spectator.component.form.get('phoneNational')?.setValue('30');
      spectator.component.form.get('phoneNumber')?.setValue('12345678');
      spectator.component.form.get('birthCountry')?.setValue('Germany');
      spectator.component.form.get('birthPlace')?.setValue('Berlin');
    });

    it('should be valid with all required fields filled correctly', () => {
      expect(spectator.component.isFormValid).toBe(true);
    });
  });
});
