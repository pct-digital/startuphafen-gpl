import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { ShTooltipComponent } from './sh-tooltip.component';

describe('ShTooltipComponent', () => {
  let spectator: Spectator<ShTooltipComponent>;
  const createComponent = createComponentFactory(ShTooltipComponent);

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });
});
