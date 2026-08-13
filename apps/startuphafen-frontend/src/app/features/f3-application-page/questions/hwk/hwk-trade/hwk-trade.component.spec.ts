import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldTextareaComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { HWK_AI_ANSWER_KEY } from '@startuphafen/startuphafen-common';
import { HwkTradeComponent } from './hwk-trade.component';

describe('HwkTradeComponent', () => {
  let spectator: Spectator<HwkTradeComponent>;

  const createComponent = createComponentFactory({
    component: HwkTradeComponent,
    imports: [
      FormlyModule.forRoot({
        types: [
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

  it('uses the title without annex references and renders the official reference links', () => {
    spectator = createComponent();
    const referenceText = spectator
      .query(byTestId('hwk-trade-reference-links'))
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

    expect(spectator.component.fields[0]?.props?.label).toBe(
      'Für welches Handwerk oder handwerksähnliche Gewerbe beantragst Du die Eintragung?'
    );
    expect(referenceText).toBe(
      'Hier findest Du eine Auflistung zulassungspflichtiger Handwerke Hier findest Du eine Auflistung zulassungsfreier Handwerke und handwerksähnlicher Gewerbe'
    );

    const referenceLinks = spectator.queryAll<HTMLAnchorElement>(
      '[data-testid="hwk-trade-reference-links"] a'
    );
    expect(referenceLinks).toHaveLength(2);
    expect(referenceLinks[0]?.href).toBe(
      'https://www.zdh.de/daten-und-fakten/handwerksordnung/gewerbe-der-handwerksordnung-anlage-a/'
    );
    expect(referenceLinks[1]?.href).toBe(
      'https://www.zdh.de/daten-und-fakten/handwerksordnung/gewerbe-anlage-b1-und-b2/'
    );
  });

  it('isAllowed returns true for hwk flow', () => {
    expect(
      HwkTradeComponent.isAllowed({
        __catalogueId: 'eun',
        Us1: 'us1Ans-2',
      })
    ).toBe(true);
  });

  it('prefills trade from stored hwk ai result', () => {
    spectator = createComponent({
      props: {
        answers: {
          [HWK_AI_ANSWER_KEY]: JSON.stringify({
            classification: 'Handwerksrolle',
            branch: 'Handwerk',
            requiresPermit: true,
            shortDescription: 'Kurzbeschreibung',
            trades: [
              'Elektrotechniker (Anlage A)',
              'Informationstechniker (Anlage A)',
            ],
          }),
        },
      },
    });

    expect(spectator.component.model['HwkTrade']).toBe(
      'Elektrotechniker (Anlage A)\nInformationstechniker (Anlage A)'
    );
    expect(spectator.query(byTestId('hwk-ai-autofill-notice'))).toExist();
  });
});
