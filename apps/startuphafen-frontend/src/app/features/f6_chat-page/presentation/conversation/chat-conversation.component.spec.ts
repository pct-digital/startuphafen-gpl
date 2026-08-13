import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { ChatAuthor } from '@startuphafen/startuphafen-common';
import { ChatConversationComponent } from './chat-conversation.component';

describe('ChatConversationPresentationComponent', () => {
  let spectator: Spectator<ChatConversationComponent>;

  const createComponent = createComponentFactory({
    component: ChatConversationComponent,
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('emits toggleHistory when the toggle button is clicked', () => {
    const emitSpy = jest.spyOn(spectator.component.toggleHistory, 'emit');

    spectator.click(byTestId('toggle-history-button'));

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits closeChat when the close button is clicked', () => {
    const emitSpy = jest.spyOn(spectator.component.closeChat, 'emit');

    spectator.click(byTestId('close-chat-button'));

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits currentMessageChange when typing in the message box', () => {
    const emitSpy = jest.spyOn(
      spectator.component.currentMessageChange,
      'emit'
    );
    const textarea = spectator.query(byTestId('message-input'));

    expect(textarea).toBeTruthy();

    if (textarea instanceof HTMLTextAreaElement) {
      spectator.typeInElement('Hallo', textarea);
    }

    expect(emitSpy).toHaveBeenLastCalledWith('Hallo');
  });

  it('emits messageSend when the send button is clicked', () => {
    spectator.setInput('currentMessage', 'Hallo');
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.messageSend, 'emit');

    spectator.click(byTestId('send-message-button'));

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits messageSend when Enter is pressed without Shift', () => {
    spectator.setInput('currentMessage', 'Hallo');
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.messageSend, 'emit');
    const textarea = spectator.query(byTestId('message-input'));

    expect(textarea).toBeTruthy();

    if (textarea instanceof HTMLTextAreaElement) {
      spectator.dispatchKeyboardEvent(textarea, 'keypress', 'Enter');
    }

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the jump button when scrolled up and scrolls down when clicked', () => {
    const rafWindow = window as typeof window & {
      requestAnimationFrame?: typeof window.requestAnimationFrame;
    };
    const originalRequestAnimationFrame = rafWindow.requestAnimationFrame;
    jest.useFakeTimers();
    rafWindow.requestAnimationFrame =
      undefined as unknown as typeof window.requestAnimationFrame;

    try {
      spectator.setInput('conversationHistory', [
        {
          id: 1,
          sessionId: 42,
          author: ChatAuthor.agent,
          content: 'Hallo',
          createdAt: new Date(),
        },
      ]);
      spectator.detectChanges();
      jest.runOnlyPendingTimers();
      spectator.detectChanges();

      const container = spectator.query(
        byTestId('messages-container')
      ) as HTMLDivElement;

      expect(container).toBeTruthy();
      Object.defineProperty(container, 'scrollHeight', {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(container, 'clientHeight', {
        value: 400,
        configurable: true,
      });

      spectator.component.scrollMessagesToBottom();
      spectator.detectChanges();
      expect(spectator.query(byTestId('scroll-to-bottom-button'))).toBeNull();

      container.scrollTop = 100;
      container.dispatchEvent(new Event('scroll'));
      spectator.detectChanges();

      expect(
        (spectator.component as { showScrollToBottomButton: boolean })
          .showScrollToBottomButton
      ).toBe(true);
      const jumpButton = spectator.query(byTestId('scroll-to-bottom-button'));
      const nativeJumpButton = spectator.fixture.nativeElement.querySelector(
        '[data-testid="scroll-to-bottom-button"]'
      ) as HTMLButtonElement | null;
      expect(nativeJumpButton).toBeTruthy();
      expect(jumpButton).toBeTruthy();

      spectator.click(jumpButton!);
      spectator.detectChanges();

      expect(container.scrollTop).toBe(container.scrollHeight);
      expect(spectator.query(byTestId('scroll-to-bottom-button'))).toBeNull();
    } finally {
      jest.useRealTimers();
      rafWindow.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});
