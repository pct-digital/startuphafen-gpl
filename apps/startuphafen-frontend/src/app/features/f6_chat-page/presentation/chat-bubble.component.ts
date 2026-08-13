import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { ChatMessage, ChatSession } from '@startuphafen/startuphafen-common';
import { ChatConversationComponent } from './conversation/chat-conversation.component';
import { ChatHistoryComponent } from './history/chat-history.component';

type ChatMessageWithOptionalId = Omit<ChatMessage, 'id'> & { id?: number };

@Component({
  selector: 'sh-chat-bubble-presentation',
  standalone: true,
  imports: [CommonModule, ChatHistoryComponent, ChatConversationComponent],
  templateUrl: './chat-bubble.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .animate-slideUp {
        animation: slideUp 0.3s ease-out;
      }

      @keyframes hintPop {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.92);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .animate-hintPop {
        animation: hintPop 0.35s ease-out;
        transform-origin: bottom right;
      }
    `,
  ],
})
export class ChatBubblePresentationComponent implements OnInit {
  private static readonly HINT_STORAGE_KEY = 'sh-chat-bubble-hint-dismissed';
  @Input() isOpen = false;
  @Input() isHistoryCollapsed = false;
  @Input() isSessionLoading = false;
  @Input() sessions: ChatSession[] = [];
  @Input() selectedSessionId: number | null = null;
  @Input() editingSessionId: number | null = null;
  @Input() editedTitle = '';
  @Input() sessionPendingDeletion: number | null = null;
  @Input() conversationHistory: ChatMessageWithOptionalId[] = [];
  @Input() isSending = false;
  @Input() isHistoryLoading = false;
  @Input() error: string | null = null;
  @Input() currentMessage = '';
  @Input() hasReachedSessionLimit = false;
  @Input() sessionLimit = 0;

  @Output() toggleChat = new EventEmitter<void>();
  @Output() startNewChat = new EventEmitter<void>();
  @Output() selectSession = new EventEmitter<number>();
  @Output() sessionRenameBegin = new EventEmitter<ChatSession>();
  @Output() editedTitleChange = new EventEmitter<string>();
  @Output() sessionRenameCommit = new EventEmitter<number>();
  @Output() sessionRenameCancel = new EventEmitter<void>();
  @Output() toggleHistory = new EventEmitter<void>();
  @Output() closeChat = new EventEmitter<void>();
  @Output() sessionDeleteRequested = new EventEmitter<number>();
  @Output() sessionDeleteConfirmed = new EventEmitter<number>();
  @Output() sessionDeleteCanceled = new EventEmitter<void>();
  @Output() currentMessageChange = new EventEmitter<string>();
  @Output() messageSend = new EventEmitter<void>();

  @ViewChild(ChatConversationComponent)
  private conversationPanel?: ChatConversationComponent;

  /** Onboarding hint shown above the button on first visit until the user interacts. */
  showHint = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.showHint = !this.readHintDismissed();
  }

  /** Dismiss the hint when the user interacts with the page in any meaningful way. */
  @HostListener('document:click')
  @HostListener('document:keydown')
  @HostListener('document:touchstart')
  onUserInteraction(): void {
    this.dismissHint();
  }

  dismissHint(): void {
    if (!this.showHint) {
      return;
    }
    this.showHint = false;
    this.persistHintDismissed();
    this.cdr.markForCheck();
  }

  private readHintDismissed(): boolean {
    try {
      return (
        sessionStorage.getItem(
          ChatBubblePresentationComponent.HINT_STORAGE_KEY
        ) === 'true'
      );
    } catch {
      return false;
    }
  }

  private persistHintDismissed(): void {
    try {
      sessionStorage.setItem(
        ChatBubblePresentationComponent.HINT_STORAGE_KEY,
        'true'
      );
    } catch {
      // sessionStorage may be unavailable (private mode); hint dismissal is best-effort.
    }
  }

  scrollMessagesToBottom(): void {
    this.conversationPanel?.scrollMessagesToBottom();
  }
}
