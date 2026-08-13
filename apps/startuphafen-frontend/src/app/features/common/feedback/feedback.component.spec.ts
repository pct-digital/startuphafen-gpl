import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import { FeedbackComponent } from './feedback.component';

describe('FeedbackComponent', () => {
  let spectator: Spectator<FeedbackComponent>;
  const createComponent = createComponentFactory({
    component: FeedbackComponent,
    mocks: [TrpcService],
  });

  beforeEach(() => {
    spectator = createComponent({ detectChanges: false });
  });

  it('should create', () => {
    spectator.detectChanges();

    expect(spectator.component).toBeTruthy();
  });

  it('should update selectedEmoji on emoji click', () => {
    spectator.detectChanges();

    const firstEmoji = spectator.query(byTestId(`emoji-0`));

    expect(firstEmoji).toBeTruthy();
    spectator.click(firstEmoji!);

    expect(spectator.component.selectedEmoji).toBe(0);
  });
});
