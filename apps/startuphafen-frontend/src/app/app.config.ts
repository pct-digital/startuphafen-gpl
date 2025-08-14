import { registerLocaleData } from '@angular/common';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import localeDe from '@angular/common/locales/de';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  importProvidersFrom,
  LOCALE_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldCheckboxSmall,
  FormlyFieldCheckComponent,
  FormlyFieldDateComponent,
  FormlyFieldInputComponent,
  FormlyFieldNumberComponent,
  FormlyFieldNumberEuroComponent,
  FormlyFieldRadioComponent,
  InitService,
  PathService,
  TrpcService,
} from '@startuphafen/angular-common';
import { WatermarkTrpcService } from '@startuphafen/watermark/angular';
import { KeycloakAngularModule, KeycloakService } from 'keycloak-angular';
import { buildRoutes } from './app.routes';

registerLocaleData(localeDe);

export function initializeFactory(init: InitService) {
  return async () => await init.initApp();
}

export function requiredTrueValidator(control: AbstractControl) {
  return !control.value ? { requiredTrue: true } : null;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(buildRoutes(new PathService())),

    {
      provide: APP_INITIALIZER,
      useFactory: initializeFactory,
      deps: [InitService],
      multi: true,
    },

    {
      provide: WatermarkTrpcService,
      useExisting: TrpcService,
    },
    { provide: KeycloakService },

    { provide: LOCALE_ID, useValue: 'de-DE' },
    importProvidersFrom([KeycloakAngularModule]),
    provideAnimations(),
    importProvidersFrom(
      FormlyModule.forRoot({
        validators: [
          { name: 'requiredTrue', validation: requiredTrueValidator },
        ],
        validationMessages: [
          {
            name: 'requiredTrue',
            message: 'Sie müssen zustimmen um fortzufahren.',
          },
        ],
        types: [
          {
            name: 'bool',
            component: FormlyFieldCheckComponent,
          },
          {
            name: 'date',
            component: FormlyFieldDateComponent,
          },
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'number',
            component: FormlyFieldNumberComponent,
          },
          {
            name: 'number-euro',
            component: FormlyFieldNumberEuroComponent,
          },
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
          },
          {
            name: 'checkbox',
            component: FormlyFieldCheckboxSmall,
          },
        ],
      })
    ),
  ],
};
