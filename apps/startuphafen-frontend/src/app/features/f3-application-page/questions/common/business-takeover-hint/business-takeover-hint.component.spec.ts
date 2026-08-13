import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { BusinessTakeoverHintComponent } from './business-takeover-hint.component';

describe('BusinessTakeoverHintComponent', () => {
  let spectator: Spectator<BusinessTakeoverHintComponent>;

  const createComponent = createComponentFactory({
    component: BusinessTakeoverHintComponent,
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });

  it('shows the business takeover link', () => {
    spectator = createComponent();

    const hint = spectator.query('[data-testid="business-takeover-hint"]');
    const link = spectator.query<HTMLAnchorElement>(
      '[data-testid="business-takeover-hint"] a'
    );

    expect(hint?.textContent).toContain('Bevor Du neu gründest');
    expect(hint?.textContent).toContain(
      'Vielleicht ist die Übernahme eines bestehenden Unternehmens für Dich eine spannende Option?'
    );
    expect(hint?.textContent).toContain(
      'Zu den Verkaufsangeboten auf nexxt-change'
    );
    expect(link?.getAttribute('href')).toBe(
      'https://www.nexxt-change.org/DE/Verkaufsangebot/inhalt'
    );
  });

  it('emits an empty answer object on submit', () => {
    spectator = createComponent();
    const emitSpy = jest.spyOn(spectator.component.stepComplete, 'emit');

    spectator.component.onSubmit();

    expect(emitSpy).toHaveBeenCalledWith({});
  });
});
