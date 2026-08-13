import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import {
  ChatAuthor,
  ChatMessage,
  ChatSession,
} from '@startuphafen/startuphafen-common';
import { of, throwError } from 'rxjs';
import { KeycloakService } from 'keycloak-angular';

import { ChatService } from '../services/chat.service';
import { ChatBubbleComponent } from './chat-bubble.component';

describe('ChatBubbleComponent', () => {
  let spectator: Spectator<ChatBubbleComponent>;
  let chatService: jest.Mocked<ChatService>;

  const createComponent = createComponentFactory({
    component: ChatBubbleComponent,
    shallow: true,
    detectChanges: false,
    mocks: [ChatService, KeycloakService],
  });

  const createSession = (
    overrides: Partial<ChatSession> = {}
  ): ChatSession => ({
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Chat session',
    createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00Z'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-02T00:00:00Z'),
    deletedAt: overrides.deletedAt ?? null,
    userId: overrides.userId ?? 'user-1',
  });

  const createMessage = (
    overrides: Partial<ChatMessage> = {}
  ): ChatMessage => ({
    id: overrides.id ?? 1,
    sessionId: overrides.sessionId ?? 1,
    author: overrides.author ?? ChatAuthor.human,
    content: overrides.content ?? 'Hello world',
    createdAt: overrides.createdAt ?? new Date('2024-01-02T10:00:00Z'),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    spectator = createComponent();
    chatService = spectator.inject(ChatService) as jest.Mocked<ChatService>;
    spectator.inject(KeycloakService).isLoggedIn.mockReturnValue(true);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should load sessions and messages on init', () => {
    const session = createSession({ id: 42 });
    const messages = [
      createMessage({ sessionId: 42, author: ChatAuthor.agent }),
    ];

    chatService.listSessions.mockReturnValue(of([session]));
    chatService.loadMessages.mockReturnValue(of(messages));

    spectator.component.selectedSessionId.set(session.id);

    spectator.component.ngOnInit();
    jest.runAllTimers();

    expect(chatService.listSessions).toHaveBeenCalledTimes(1);
    expect(chatService.loadMessages).toHaveBeenCalledWith(session.id);
    expect(spectator.component.sessions()).toEqual([session]);
    expect(spectator.component.selectedSessionId()).toBe(session.id);
    expect(spectator.component.conversationHistory()).toEqual(messages);
    expect(spectator.component.isSessionLoading()).toBe(false);
    expect(spectator.component.isHistoryLoading()).toBe(false);
  });

  it('should not call listSessions on init when user is logged out', () => {
    spectator.inject(KeycloakService).isLoggedIn.mockReturnValue(false);

    spectator.component.ngOnInit();
    jest.runAllTimers();

    expect(chatService.listSessions).not.toHaveBeenCalled();
    expect(chatService.loadMessages).not.toHaveBeenCalled();
    expect(spectator.component.sessions()).toEqual([]);
    expect(spectator.component.selectedSessionId()).toBeNull();
    expect(spectator.component.isSessionLoading()).toBe(false);
  });

  it('should toggle chat open and refresh sessions', () => {
    const session = createSession({ id: 7 });
    const messages = [createMessage({ sessionId: 7 })];

    chatService.listSessions.mockReturnValue(of([session]));
    chatService.loadMessages.mockReturnValue(of(messages));

    spectator.component.selectedSessionId.set(session.id);

    spectator.component.toggleChat();
    jest.runAllTimers();

    expect(spectator.component.isOpen()).toBe(true);
    expect(spectator.component.isHistoryCollapsed()).toBe(false);
    expect(chatService.listSessions).toHaveBeenCalledTimes(1);

    chatService.listSessions.mockClear();
    spectator.component.toggleChat();

    expect(spectator.component.isOpen()).toBe(false);
    expect(chatService.listSessions).not.toHaveBeenCalled();
  });

  it('opens with collapsed history on mobile viewport', () => {
    const session = createSession({ id: 21 });

    const originalInnerWidth = window.innerWidth;
    const originalMatchMedia = window.matchMedia;

    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: undefined,
      });

      chatService.listSessions.mockReturnValue(of([session]));
      chatService.loadMessages.mockReturnValue(of([]));

      spectator.component.isHistoryCollapsed.set(false);
      spectator.component.toggleChat();
      jest.runAllTimers();

      expect(spectator.component.isOpen()).toBe(true);
      expect(spectator.component.isHistoryCollapsed()).toBe(true);
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('should send a message and update the conversation on success', () => {
    const initialSession = createSession({
      id: 3,
      updatedAt: new Date('2024-02-01T00:00:00Z'),
    });
    const updatedSession = createSession({
      id: 3,
      title: 'Updated chat',
      updatedAt: new Date('2024-03-01T00:00:00Z'),
    });
    const responseMessages = [
      createMessage({ id: 1, sessionId: 3, author: ChatAuthor.human }),
      createMessage({
        id: 2,
        sessionId: 3,
        author: ChatAuthor.agent,
        content: 'Antwort',
      }),
    ];

    chatService.sendMessage.mockReturnValue(
      of({ session: updatedSession, messages: responseMessages })
    );

    spectator.component.sessions.set([initialSession]);
    spectator.component.selectedSessionId.set(initialSession.id);
    spectator.component.currentMessage.set(' Hallo ');
    spectator.component.conversationHistory.set([]);

    spectator.component.sendMessage();
    jest.runAllTimers();

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      initialSession.id,
      'Hallo'
    );
    expect(spectator.component.isSending()).toBe(false);
    expect(spectator.component.currentMessage()).toBe('');
    expect(spectator.component.error()).toBeNull();
    expect(spectator.component.conversationHistory()).toEqual(responseMessages);
    expect(spectator.component.selectedSessionId()).toBe(updatedSession.id);
    expect(spectator.component.sessions()[0]).toEqual(updatedSession);
  });

  it('should surface an error when sending a message fails', () => {
    const session = createSession({ id: 9 });
    const error = new Error('Network error');
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    chatService.sendMessage.mockReturnValue(throwError(() => error));

    spectator.component.selectedSessionId.set(session.id);
    spectator.component.currentMessage.set('Hello');
    spectator.component.conversationHistory.set([]);

    spectator.component.sendMessage();
    jest.runAllTimers();

    expect(chatService.sendMessage).toHaveBeenCalledWith(session.id, 'Hello');
    expect(spectator.component.isSending()).toBe(false);
    expect(spectator.component.error()).toBe(
      'Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.'
    );
    expect(spectator.component.conversationHistory()).toHaveLength(1);
    expect(spectator.component.conversationHistory()[0].content).toBe('Hello');

    consoleSpy.mockRestore();
  });

  it('should start a new chat session and show the welcome message', () => {
    const newSession = createSession({
      id: 11,
      title: 'New Session',
      updatedAt: new Date('2024-04-01T00:00:00Z'),
    });

    chatService.createSession.mockReturnValue(of(newSession));

    spectator.component.startNewChat();
    jest.runAllTimers();

    expect(chatService.createSession).toHaveBeenCalledTimes(1);
    expect(spectator.component.selectedSessionId()).toBe(newSession.id);
    expect(spectator.component.sessions()[0]).toEqual(newSession);
    expect(spectator.component.conversationHistory()).toHaveLength(1);

    const welcomeMessage = spectator.component.conversationHistory()[0];
    expect(welcomeMessage.author).toBe(ChatAuthor.agent);
    expect(welcomeMessage.sessionId).toBe(newSession.id);
    expect(welcomeMessage.content).toBe(
      'Hallo! Ich bin Dein digitaler Assistent. Wie kann ich Dich unterstützen?'
    );
    expect(spectator.component.isSessionLoading()).toBe(false);
    expect(spectator.component.sessionPendingDeletion()).toBeNull();
    expect(spectator.component.error()).toBeNull();
  });

  it('gracefully reports when sending without an active session', () => {
    chatService.listSessions.mockReturnValue(of([]));

    spectator.component.ngOnInit();
    spectator.component.currentMessage.set('Hallo');

    const sendSpy = chatService.sendMessage;

    spectator.component.sendMessage();
    jest.runAllTimers();

    expect(sendSpy).not.toHaveBeenCalled();
    expect(spectator.component.error()).toBe('Kein aktiver Chat ausgewählt.');
    expect(spectator.component.isSending()).toBe(false);
  });

  it('shows a descriptive error when the session limit is reached', () => {
    const sessions = Array.from({ length: 10 }, (_, index) =>
      createSession({ id: index + 1 })
    );

    chatService.listSessions.mockReturnValue(of(sessions));
    chatService.loadMessages.mockReturnValue(of([]));
    spectator.component.sessions.set(sessions);
    spectator.detectChanges();

    chatService.createSession.mockReturnValue(
      throwError(() => ({
        data: { code: 'PRECONDITION_FAILED' },
        message: 'Maximum of 10 chat sessions reached',
      }))
    );

    spectator.component.startNewChat();
    jest.runAllTimers();

    expect(chatService.createSession).toHaveBeenCalledTimes(1);
    expect(spectator.component.error()).toBe(
      'Du hast die maximale Anzahl von 10 Chats erreicht. Lösche einen bestehenden Chat, um fortzufahren.'
    );
    expect(spectator.component.isSessionLoading()).toBe(false);
    expect(spectator.component.hasReachedSessionLimit()).toBe(true);
  });
});
