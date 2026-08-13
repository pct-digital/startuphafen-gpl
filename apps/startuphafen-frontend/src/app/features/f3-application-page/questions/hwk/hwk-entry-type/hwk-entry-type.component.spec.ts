import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { HWK_AI_ANSWER_KEY } from '@startuphafen/startuphafen-common';
import { HwkEntryTypeComponent } from './hwk-entry-type.component';

describe('HwkEntryTypeComponent', () => {
  let spectator: Spectator<HwkEntryTypeComponent>;

  const createComponent = createComponentFactory({
    component: HwkEntryTypeComponent,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
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

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('isAllowed returns true for eun handwerk branch', () => {
    expect(
      HwkEntryTypeComponent.isAllowed({
        __catalogueId: 'eun',
        Us1: 'us1Ans-2',
      })
    ).toBe(true);
  });

  it('isAllowed returns false for non-hwk flow', () => {
    expect(
      HwkEntryTypeComponent.isAllowed({
        __catalogueId: 'eun',
        Us1: 'us1Ans-1',
      })
    ).toBe(false);
  });

  it('shows ai autofill hint when entry type matches ki suggestion', () => {
    spectator = createComponent({
      props: {
        answers: {
          HwkEntryType: 'hwkEntryAns-2',
          [HWK_AI_ANSWER_KEY]: JSON.stringify({
            classification: 'zulassungsfreien Handwerksbetriebe',
            branch: 'Handwerk',
            requiresPermit: true,
            shortDescription: 'Kurzbeschreibung',
            trades: ['Gebäudereiniger (Anlage B1)'],
          }),
        },
      },
    });

    expect(spectator.query(byTestId('hwk-ai-autofill-notice'))).toExist();
  });

  it('renders the official reference links below the entry type question', () => {
    spectator = createComponent();
    const referenceText = spectator
      .query(byTestId('hwk-entry-type-reference-links'))
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

    expect(referenceText).toBe(
      'Hier findest Du eine Auflistung zulassungspflichtiger Handwerke Hier findest Du eine Auflistung zulassungsfreier Handwerke und handwerksähnlicher Gewerbe'
    );

    const referenceLinks = spectator.queryAll<HTMLAnchorElement>(
      '[data-testid="hwk-entry-type-reference-links"] a'
    );
    expect(referenceLinks).toHaveLength(2);
    expect(referenceLinks[0]?.href).toBe(
      'https://www.zdh.de/daten-und-fakten/handwerksordnung/gewerbe-der-handwerksordnung-anlage-a/'
    );
    expect(referenceLinks[1]?.href).toBe(
      'https://www.zdh.de/daten-und-fakten/handwerksordnung/gewerbe-anlage-b1-und-b2/'
    );
  });
});
