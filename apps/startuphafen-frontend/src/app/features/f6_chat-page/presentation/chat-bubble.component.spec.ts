import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import {
  ChatAuthor,
  ChatMessage,
  ChatSession,
} from '@startuphafen/startuphafen-common';
import { ChatBubblePresentationComponent } from './chat-bubble.component';
import { ChatHistoryComponent } from './history/chat-history.component';
import { ChatConversationComponent } from './conversation/chat-conversation.component';

describe('ChatBubblePresentationComponent', () => {
  let spectator: Spectator<ChatBubblePresentationComponent>;

  const sessions: ChatSession[] = [
    {
      id: 1,
      title: 'Chat 1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      userId: 'user-1',
    },
  ];

  const messages: ChatMessage[] = [
    {
      author: ChatAuthor.system,
      content: 'Willkommen',
      createdAt: new Date(),
      id: 1,
      sessionId: 1,
    },
  ];

  const createComponent = createComponentFactory({
    component: ChatBubblePresentationComponent,
    imports: [ChatHistoryComponent, ChatConversationComponent],
  });

  beforeEach(() => {
    sessionStorage.clear();
    spectator = createComponent();
  });

  it('shows the onboarding hint on first visit', () => {
    expect(spectator.query(byTestId('chat-bubble-hint'))).toExist();
  });

  it('hides the onboarding hint after the user interacts with the page', () => {
    expect(spectator.query(byTestId('chat-bubble-hint'))).toExist();

    document.dispatchEvent(new MouseEvent('click'));
    spectator.detectChanges();

    expect(spectator.query(byTestId('chat-bubble-hint'))).not.toExist();
    expect(sessionStorage.getItem('sh-chat-bubble-hint-dismissed')).toBe(
      'true'
    );
  });

  it('does not show the onboarding hint once it has been dismissed before', () => {
    sessionStorage.setItem('sh-chat-bubble-hint-dismissed', 'true');

    const freshSpectator = createComponent();
    freshSpectator.detectChanges();

    expect(freshSpectator.query(byTestId('chat-bubble-hint'))).not.toExist();
  });

  it('emits toggleChat when the chat bubble is clicked', () => {
    const emitSpy = jest.spyOn(spectator.component.toggleChat, 'emit');

    spectator.click(byTestId('chat-bubble-button'));

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits closeChat when the close button in the window is clicked', () => {
    spectator.setInput('isOpen', true);
    spectator.setInput('sessions', sessions);
    spectator.setInput('conversationHistory', messages);
    spectator.setInput('currentMessage', 'Hallo');
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.closeChat, 'emit');

    spectator.click(byTestId('close-chat-button'));

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('re-emits startNewChat output from the history panel', () => {
    spectator.setInput('isOpen', true);
    spectator.setInput('sessions', sessions);
    spectator.setInput('conversationHistory', messages);
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.startNewChat, 'emit');

    spectator.triggerEventHandler('sh-chat-history', 'startNewChat', undefined);

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('re-emits messageSend output from the conversation panel', () => {
    spectator.setInput('isOpen', true);
    spectator.setInput('sessions', sessions);
    spectator.setInput('conversationHistory', messages);
    spectator.setInput('currentMessage', 'Hallo');
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.messageSend, 'emit');

    spectator.triggerEventHandler(
      'sh-chat-conversation',
      'messageSend',
      undefined
    );

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });
});
