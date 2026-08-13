import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  PctLoaderService,
  ShButtonDirective,
} from '@startuphafen/angular-common';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { ProfileInfoService } from './profile-info.service';

interface ProfileInfoModel {
  phoneInternational: string;
  phoneNational: string;
  phoneNumber: string;
  website: string;
  birthCountry: string;
  birthPlace: string;
}

@Component({
  selector: 'sh-profile-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ShButtonDirective, FormlyModule],
  templateUrl: './profile-info.component.html',
  styles: [
    `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-fade-in {
        animation: fadeIn 0.5s ease-out forwards;
      }
    `,
  ],
})
export class ProfileInfoComponent implements OnInit {
  @Output() profileSaved = new EventEmitter<void>();

  form: FormGroup;
  model: ProfileInfoModel = {
    phoneInternational: '+49',
    phoneNational: '',
    phoneNumber: '',
    website: '',
    birthCountry: '',
    birthPlace: '',
  };

  fields: FormlyFieldConfig[] = [
    {
      key: 'birthCountry',
      type: 'profile-input',
      className: 'block mb-4',
      props: {
        disabled: false,
        label: 'Geburtsland',
        placeholder: 'Deutschland',
        required: true,
        pattern: /^\S.*\S$|^\S$/,
      },
    },
    {
      key: 'birthPlace',
      type: 'profile-input',
      className: 'block mb-4',
      props: {
        disabled: false,
        label: 'Geburtsort',
        placeholder: 'Berlin',
        required: true,
        pattern: /^\S.*\S$|^\S$/,
      },
    },
    {
      template:
        '<label class="block text-sm font-medium text-tertiary mb-1">Telefonnummer <span class="text-red-500">*</span></label>',
    },
    {
      fieldGroupClassName: 'flex gap-2 items-start mb-4',
      fieldGroup: [
        {
          key: 'phoneInternational',
          type: 'profile-input',
          className: 'w-20 shrink-0',
          props: {
            placeholder: '+49',
            disabled: true,
            hideErrorMessage: true,
          },
        },
        {
          key: 'phoneNational',
          type: 'profile-input',
          className: 'w-24 shrink-0',
          props: {
            placeholder: '30',
            required: true,
            pattern: /^\d+$/,
            hideErrorMessage: true,
          },
        },
        {
          key: 'phoneNumber',
          type: 'profile-input',
          className: 'flex-1',
          props: {
            placeholder: '12345678',
            required: true,
            pattern: /^\d+$/,
            hideErrorMessage: true,
          },
        },
      ],
      validators: {
        phoneNumberCheck: {
          expression: (c: AbstractControl) =>
            parsePhoneNumberFromString(
              `+49 ${c.value.phoneNational} ${c.value.phoneNumber}`
            )?.isValid(),
        },
      },
    },
  ];

  error: string | null = null;

  constructor(
    private profileInfoService: ProfileInfoService,
    private fb: FormBuilder,
    private loaderService: PctLoaderService
  ) {
    this.form = this.fb.group({});
  }

  async ngOnInit() {
    await this.loaderService.doWhileLoading(
      'ProfileInfo.loadExisting',
      async () => {
        const profile = await this.profileInfoService.get();

        this.model = {
          phoneInternational: this.model.phoneInternational,
          phoneNational: profile?.phoneNational ?? '',
          phoneNumber: profile?.phoneNumber ?? '',
          website: profile?.website ?? '',
          birthCountry: profile?.birthCountry ?? '',
          birthPlace: profile?.birthPlace ?? '',
        };

        this.form.patchValue(this.model);
      }
    );
  }

  get isFormValid() {
    return this.form.valid;
  }

  get phoneError() {
    const phoneNational = this.form.get('phoneNational');
    const phoneNumber = this.form.get('phoneNumber');

    if (phoneNational?.touched && phoneNational?.errors) {
      return 'Bitte gib eine gültige Vorwahl ein.';
    }
    if (phoneNumber?.touched && phoneNumber?.errors) {
      return 'Bitte gib eine gültige Rufnummer ein.';
    }

    if (
      phoneNational?.touched &&
      phoneNumber?.touched &&
      this.form.errors?.['phoneNumberCheck']
    ) {
      return 'Bitte gib eine gültige Telefonnummer ein.';
    }

    return null;
  }

  async saveProfile() {
    this.form.markAllAsTouched();

    if (!this.form.valid) {
      return;
    }

    this.error = null;

    await this.loaderService.doWhileLoading(
      'ProfileInfo.saveProfile',
      async () => {
        try {
          await this.profileInfoService.create({
            phoneInternational: this.model.phoneInternational,
            phoneNational: this.model.phoneNational,
            phoneNumber: this.model.phoneNumber,
            website: this.model.website || null,
            birthCountry: this.model.birthCountry,
            birthPlace: this.model.birthPlace,
          });

          this.profileSaved.emit();
        } catch (err) {
          this.error = 'Fehler beim Speichern. Bitte versuche es erneut.';
        }
      }
    );
  }
}
