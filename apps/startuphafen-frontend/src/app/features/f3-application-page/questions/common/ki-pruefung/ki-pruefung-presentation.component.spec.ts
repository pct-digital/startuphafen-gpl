import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { FormGroup } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldInputComponent,
  FormlyFieldTextareaComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { KiPruefungPresentationComponent } from './ki-pruefung-presentation.component';

describe('KiPruefungPresentationComponent', () => {
  let spectator: Spectator<KiPruefungPresentationComponent>;
  const createComponent = createComponentFactory({
    component: KiPruefungPresentationComponent,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'textarea',
            component: FormlyFieldTextareaComponent,
          },
        ],
        wrappers: [
          {
            name: 'heading',
            component: FormlyWrapperHeading,
          },
        ],
      }),
    ],
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        form: new FormGroup({}),
        formModel: {},
        fields: [],
      },
    });
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should emit runHwkAi when run button is clicked', () => {
    spectator.setInput('canRunHwkAi', true);
    const runSpy = jest.spyOn(spectator.component.runHwkAi, 'emit');

    spectator.click(byTestId('ki-pruefung-run'));

    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  it('should disable run button when canRunHwkAi is false', () => {
    spectator.setInput('canRunHwkAi', false);

    expect(spectator.query(byTestId('ki-pruefung-run'))).toBeDisabled();
  });

  it('should show loading state on run button without skeleton when hwkAiLoading is true', () => {
    spectator.setInput('hwkAiLoading', true);
    spectator.detectChanges();

    expect(spectator.query(byTestId('ki-pruefung-run'))).toHaveText(
      'KI-Prüfung läuft...'
    );
    expect(spectator.query('.ki-pruefung-ai-result-skeleton')).toBeNull();
  });

  it('should render helper text next to the run button', () => {
    const helperElement = spectator.query<HTMLElement>(
      byTestId('ki-pruefung-helper')
    );
    const helperText = helperElement
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

    expect(helperText).toBe(
      'Die KI-Prüfung unterstützt Dich beim Ausfüllen der Fragen. Je genauer Deine Beschreibung, desto besser kann die KI helfen.'
    );
    expect(helperElement).toHaveClass('text-left');
  });

  it('should render an error message when hwkAiError exists', () => {
    spectator.setInput('hwkAiError', 'Fehler');
    spectator.detectChanges();

    expect(spectator.query('.text-red-600')).toHaveText('Fehler');
  });
});
