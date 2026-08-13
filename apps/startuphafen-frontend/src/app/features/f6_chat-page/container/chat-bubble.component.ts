import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  ChatAuthor,
  ChatMessage,
  ChatSession,
} from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import { ChatBubblePresentationComponent } from '../presentation/chat-bubble.component';
import { ChatService } from '../services/chat.service';

const WELCOME_TEXT =
  'Hallo! Ich bin Dein digitaler Assistent. Wie kann ich Dich unterstützen?';
const EMPTY_SESSION_TEXT =
  'Dieser Chat ist noch leer. Schreibe Deine erste Nachricht, um zu beginnen.';
const MAX_CHAT_SESSIONS = 10;

type ChatMessageWithOptionalId = Omit<ChatMessage, 'id'> & { id?: number };

@Component({
  selector: 'sh-chat-bubble',
  standalone: true,
  imports: [ChatBubblePresentationComponent],
  templateUrl: './chat-bubble.component.html',
})
export class ChatBubbleComponent implements OnInit, AfterViewInit {
  private chatService = inject(ChatService);
  private keycloak = inject(KeycloakService);
  private hostElement = inject(ElementRef) as ElementRef<HTMLElement>;

  @ViewChild(ChatBubblePresentationComponent)
  private presentation?: ChatBubblePresentationComponent;

  conversationHistory = signal<ChatMessageWithOptionalId[]>([]);
  sessions = signal<ChatSession[]>([]);
  selectedSessionId = signal<number | null>(null);
  editingSessionId = signal<number | null>(null);
  editedTitle = signal<string>('');
  sessionPendingDeletion = signal<number | null>(null);
  currentMessage = signal<string>('');
  isSending = signal<boolean>(false);
  isSessionLoading = signal<boolean>(false);
  isHistoryLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  isOpen = signal<boolean>(false);
  isHistoryCollapsed = signal<boolean>(false);
  readonly sessionLimit = MAX_CHAT_SESSIONS;
  readonly hasReachedSessionLimit = computed(
    () => this.sessions().length >= MAX_CHAT_SESSIONS
  );

  constructor() {
    effect(() => {
      this.conversationHistory();
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  ngOnInit(): void {
    this.resetConversationToWelcome();

    if (!this.keycloak.isLoggedIn()) {
      this.sessions.set([]);
      this.selectedSessionId.set(null);
      this.isSessionLoading.set(false);
      this.isHistoryLoading.set(false);
      return;
    }

    this.refreshSessions();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }

    const targetNode = event.target as Node | null;
    if (!targetNode) {
      return;
    }

    const hostNativeElement = this.hostElement.nativeElement;
    const chatWindow = hostNativeElement.querySelector(
      '[data-testid="chat-window"]'
    );
    const toggleButton = hostNativeElement.querySelector(
      '[data-testid="chat-bubble-button"]'
    );

    if (
      (chatWindow && chatWindow.contains(targetNode)) ||
      (toggleButton && toggleButton.contains(targetNode))
    ) {
      return;
    }

    this.closeChat();
  }

  toggleChat(): void {
    const nextState = !this.isOpen();

    if (nextState && !this.keycloak.isLoggedIn()) {
      this.isOpen.set(false);
      return;
    }

    this.isOpen.set(nextState);

    if (nextState) {
      this.isHistoryCollapsed.set(this.isMobileViewport());
      this.refreshSessions();
    }
  }

  closeChat(): void {
    this.isOpen.set(false);
    this.isHistoryCollapsed.set(false);
    this.sessionPendingDeletion.set(null);
  }

  sendMessage(): void {
    const messageText = this.currentMessage().trim();

    if (!messageText || this.isSending()) {
      return;
    }

    const sessionId = this.selectedSessionId();

    if (!sessionId) {
      this.error.set('Kein aktiver Chat ausgewählt.');
      console.error('No active chat session selected.');
      return;
    }

    const humanMessage: ChatMessageWithOptionalId = {
      content: messageText,
      author: ChatAuthor.human,
      createdAt: new Date(),
      sessionId: sessionId,
    };

    this.conversationHistory.set([...this.conversationHistory(), humanMessage]);
    this.currentMessage.set('');
    this.isSending.set(true);
    this.error.set(null);

    this.chatService.sendMessage(sessionId, messageText).subscribe({
      next: ({ session, messages }) => {
        this.selectedSessionId.set(session.id);
        this.updateSessionListWith(session);
        this.conversationHistory.set(
          messages.length > 0
            ? messages
            : [this.buildAssistantMessage(EMPTY_SESSION_TEXT, session.id)]
        );
        this.isSending.set(false);
      },
      error: (err) => {
        console.error('Error in chat component:', err);
        this.isSending.set(false);
        if (err.message === 'API Key not configured') {
          this.error.set('API Key nicht konfiguriert, Chat deaktiviert');
        } else {
          this.error.set(
            'Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.'
          );
        }
      },
    });
  }

  startNewChat(): void {
    if (this.isSessionLoading()) {
      return;
    }

    this.isSessionLoading.set(true);
    this.sessionPendingDeletion.set(null);
    this.chatService.createSession().subscribe({
      next: (session) => {
        this.isSessionLoading.set(false);
        this.selectedSessionId.set(session.id);
        this.updateSessionListWith(session);
        if (this.isMobileViewport()) {
          this.isHistoryCollapsed.set(true);
        }
        this.resetConversationToWelcome();
        this.currentMessage.set('');
        this.editingSessionId.set(null);
        this.error.set(null);
      },
      error: (err) => {
        console.error('Failed to create chat session:', err);
        const errorMessage = this.isSessionLimitError(err)
          ? `Du hast die maximale Anzahl von ${MAX_CHAT_SESSIONS} Chats erreicht. Lösche einen bestehenden Chat, um fortzufahren.`
          : 'Neuer Chat konnte nicht erstellt werden. Bitte versuche es erneut.';
        this.error.set(errorMessage);
        this.isSessionLoading.set(false);
      },
    });
  }

  selectSession(sessionId: number): void {
    if (this.selectedSessionId() === sessionId) {
      if (this.isMobileViewport()) {
        this.isHistoryCollapsed.set(true);
      }
      return;
    }

    this.selectedSessionId.set(sessionId);
    if (this.isMobileViewport()) {
      this.isHistoryCollapsed.set(true);
    }
    this.error.set(null);
    this.sessionPendingDeletion.set(null);
    this.loadMessagesForSession(sessionId);
  }

  beginRename(session: ChatSession): void {
    this.editingSessionId.set(session.id);
    this.editedTitle.set(session.title);
  }

  commitRename(sessionId: number): void {
    const newTitle = this.editedTitle().trim();
    const session = this.sessions().find((s) => s.id === sessionId);

    if (!session) {
      this.cancelRename();
      return;
    }

    if (!newTitle || newTitle === session.title) {
      this.cancelRename();
      return;
    }

    this.chatService.renameSession(sessionId, newTitle).subscribe({
      next: (updatedSession) => {
        this.updateSessionListWith(updatedSession);
        if (this.selectedSessionId() === updatedSession.id) {
          this.selectedSessionId.set(updatedSession.id);
        }
        this.editingSessionId.set(null);
      },
      error: (err) => {
        console.error('Failed to rename chat session:', err);
        this.error.set(
          'Der Chat konnte nicht umbenannt werden. Bitte versuche es erneut.'
        );
        this.editingSessionId.set(null);
      },
    });
  }

  cancelRename(): void {
    this.editingSessionId.set(null);
    this.editedTitle.set('');
  }

  toggleHistory(): void {
    this.isHistoryCollapsed.set(!this.isHistoryCollapsed());
  }

  requestDelete(sessionId: number): void {
    this.sessionPendingDeletion.set(sessionId);
  }

  confirmDelete(sessionId: number): void {
    this.chatService.deleteSession(sessionId).subscribe({
      next: () => {
        const remaining = this.sessions().filter((s) => s.id !== sessionId);
        this.sessions.set(remaining);
        this.editingSessionId.set(null);
        this.sessionPendingDeletion.set(null);

        if (this.selectedSessionId() === sessionId) {
          if (remaining.length > 0) {
            const nextSessionId = remaining[0].id;
            this.selectedSessionId.set(nextSessionId);
            this.loadMessagesForSession(nextSessionId);
          } else {
            this.selectedSessionId.set(null);
            this.resetConversationToWelcome();
          }
        }
      },
      error: (err) => {
        console.error('Failed to delete chat session:', err);
        this.error.set(
          'Der Chat konnte nicht gelöscht werden. Bitte versuche es erneut.'
        );
        this.sessionPendingDeletion.set(null);
      },
    });
  }

  cancelDelete(): void {
    this.sessionPendingDeletion.set(null);
  }

  onEditedTitleChange(value: string): void {
    this.editedTitle.set(value ?? '');
  }

  onCurrentMessageChange(value: string): void {
    this.currentMessage.set(value ?? '');
  }

  private refreshSessions(preferredSessionId?: number | null): void {
    this.isSessionLoading.set(true);
    this.sessionPendingDeletion.set(null);

    this.chatService.listSessions().subscribe({
      next: (sessions) => {
        this.sessions.set(
          sessions.slice().sort((a, b) => {
            return (
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          })
        );
        this.isSessionLoading.set(false);

        if (this.sessions().length === 0) {
          this.selectedSessionId.set(null);
          this.resetConversationToWelcome();
          return;
        }

        const preferred =
          preferredSessionId ??
          this.selectedSessionId() ??
          this.sessions()[0].id;
        const fallback = this.sessions()[0].id;
        const sessionToSelect = this.sessions().some((s) => s.id === preferred)
          ? preferred
          : fallback;

        this.selectedSessionId.set(sessionToSelect);
        this.loadMessagesForSession(sessionToSelect);
      },
      error: (err) => {
        console.error('Failed to load chat sessions:', err);
        this.error.set(
          'Chats konnten nicht geladen werden. Bitte versuche es erneut.'
        );
        this.isSessionLoading.set(false);
      },
    });
  }

  private loadMessagesForSession(sessionId: number): void {
    this.isHistoryLoading.set(true);
    this.sessionPendingDeletion.set(null);
    this.chatService.loadMessages(sessionId).subscribe({
      next: (messages) => {
        if (messages.length === 0) {
          this.conversationHistory.set([
            this.buildAssistantMessage(EMPTY_SESSION_TEXT, sessionId),
          ]);
        } else {
          this.conversationHistory.set(messages);
        }
        this.isHistoryLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load chat messages:', err);
        this.error.set(
          'Nachrichten konnten nicht geladen werden. Bitte versuche es erneut.'
        );
        this.isHistoryLoading.set(false);
      },
    });
  }

  private updateSessionListWith(session: ChatSession): void {
    const currentSessions = this.sessions();
    const filtered = currentSessions.filter((s) => s.id !== session.id);
    const updatedList = [session, ...filtered].sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    this.sessions.set(updatedList);
    if (this.sessionPendingDeletion() === session.id) {
      this.sessionPendingDeletion.set(null);
    }
  }

  private resetConversationToWelcome(): void {
    const sessionId = this.selectedSessionId();

    if (!sessionId) {
      this.conversationHistory.set([]);
      return;
    }

    this.conversationHistory.set([
      this.buildAssistantMessage(WELCOME_TEXT, sessionId),
    ]);
  }

  private buildAssistantMessage(
    content: string,
    sessionId: number
  ): ChatMessageWithOptionalId {
    return {
      content,
      author: ChatAuthor.agent,
      createdAt: new Date(),
      sessionId,
    };
  }

  private scrollToBottom(): void {
    try {
      this.presentation?.scrollMessagesToBottom();
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  private isSessionLimitError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const maybeError = error as {
      data?: { code?: string };
      message?: unknown;
    };

    if (maybeError.data?.code === 'PRECONDITION_FAILED') {
      return true;
    }

    return typeof maybeError.message === 'string'
      ? maybeError.message.includes('Maximum of')
      : false;
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(max-width: 639px)').matches;
    }

    return window.innerWidth < 640;
  }
}
