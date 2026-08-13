import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShButtonDirective } from '@startuphafen/angular-common';
import { ChatMessage } from '@startuphafen/startuphafen-common';
import { marked } from 'marked';

type ChatMessageWithOptionalId = Omit<ChatMessage, 'id'> & { id?: number };

@Component({
  selector: 'sh-chat-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, ShButtonDirective],
  templateUrl: './chat-conversation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        --chat-light-text-rgb: 45, 45, 45;
        --chat-light-text: rgb(var(--chat-light-text-rgb));
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

      .scroll-to-bottom-button {
        animation: fadeInFloat 0.25s ease-out;
      }

      .scroll-to-bottom-button svg {
        animation: arrowLift 1.6s ease-in-out infinite;
      }

      @keyframes fadeInFloat {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes arrowLift {
        0% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(3px);
        }
        100% {
          transform: translateY(0);
        }
      }

      /* Markdown content styles */
      ::ng-deep .markdown-content {
        h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
        }

        h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.875rem;
          margin-bottom: 0.625rem;
          line-height: 1.3;
        }

        h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        h4,
        h5,
        h6 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 0.625rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        p {
          margin-top: 0;
          margin-bottom: 0.75rem;
          line-height: 1.6;
        }

        p:last-child {
          margin-bottom: 0;
        }

        ul,
        ol {
          margin-top: 0.5rem;
          margin-bottom: 0.75rem;
          padding-left: 1.5rem;
        }

        ul {
          list-style-type: disc;
        }

        ol {
          list-style-type: decimal;
        }

        li {
          margin-bottom: 0.25rem;
          line-height: 1.6;
        }

        li:last-child {
          margin-bottom: 0;
        }

        blockquote {
          margin: 0.75rem 0;
          padding-left: 1rem;
          border-left: 3px solid rgba(var(--sh-color-primary-rgb), 0.3);
          font-style: italic;
          opacity: 0.9;
        }

        blockquote p {
          margin-bottom: 0.5rem;
        }

        code {
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.875em;
        }

        pre {
          margin: 0.75rem 0;
          padding: 0.75rem;
          border-radius: 0.5rem;
          overflow-x: auto;
        }

        pre code {
          padding: 0;
          background: transparent;
          border-radius: 0;
        }

        a {
          color: var(--sh-color-primary);
          text-decoration: underline;
          text-decoration-color: rgba(var(--sh-color-primary-rgb), 0.4);
          transition: text-decoration-color 0.2s ease;
        }

        a:hover {
          text-decoration-color: var(--sh-color-primary);
        }

        strong {
          font-weight: 600;
        }

        em {
          font-style: italic;
        }

        hr {
          margin: 1rem 0;
          border: none;
          border-top: 1px solid rgba(var(--chat-light-text-rgb), 0.15);
        }

        table {
          width: 100%;
          margin: 0.75rem 0;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 0.5rem;
          border: 1px solid rgba(var(--chat-light-text-rgb), 0.15);
          text-align: left;
        }

        th {
          font-weight: 600;
          background-color: rgba(var(--chat-light-text-rgb), 0.05);
        }
      }
    `,
  ],
})
export class ChatConversationComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() isHistoryCollapsed = false;
  @Input() conversationHistory: ChatMessageWithOptionalId[] = [];
  @Input() isSending = false;
  @Input() isHistoryLoading = false;
  @Input() error: string | null = null;
  @Input() currentMessage = '';

  @Output() toggleHistory = new EventEmitter<void>();
  @Output() closeChat = new EventEmitter<void>();
  @Output() currentMessageChange = new EventEmitter<string>();
  @Output() messageSend = new EventEmitter<void>();

  @ViewChild('messagesContainer')
  private messagesContainer?: ElementRef<HTMLElement>;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  private parsedContentCache = new Map<string, string>();
  private previousMessageCount = 0;
  private scrollListener?: () => void;
  showScrollToBottomButton = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversationHistory']) {
      const currentCount = this.conversationHistory?.length ?? 0;
      if (currentCount > this.previousMessageCount) {
        setTimeout(() => this.scrollMessagesToBottom(), 0);
      }
      this.previousMessageCount = currentCount;
    }
  }

  ngAfterViewInit(): void {
    this.previousMessageCount = this.conversationHistory?.length ?? 0;
    this.attachScrollListener();
    this.scrollMessagesToBottom();
  }

  ngOnDestroy(): void {
    this.detachScrollListener();
  }

  scrollMessagesToBottom(): void {
    const element = this.messagesContainer?.nativeElement;
    if (!element) {
      return;
    }

    const performScroll = () => {
      if (typeof element.scrollTo === 'function') {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        element.scrollTop = element.scrollHeight;
      }
      this.updateScrollButtonVisibility();
    };

    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      window.requestAnimationFrame(performScroll);
    } else {
      performScroll();
    }
  }

  onMessageKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.messageSend.emit();
    }
  }

  authorLabel(author: ChatMessage['author']): string {
    switch (author) {
      case 'human':
        return 'Du';
      case 'agent':
        return 'KI Assistent';
      default:
        return 'System';
    }
  }

  messageBubbleStyles(author: ChatMessage['author']): Record<string, string> {
    switch (author) {
      case 'human':
        return {
          backgroundColor: 'var(--sh-color-primary)',
          color: 'var(--sh-color-primary-contrast)',
          border: '1px solid rgba(var(--sh-color-primary-rgb), 0.28)',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
        };
      case 'agent':
        return {
          backgroundColor: 'rgba(var(--sh-color-dark-rgb), 0.06)',
          color: 'var(--chat-light-text)',
          border: '1px solid rgba(var(--sh-color-dark-rgb), 0.08)',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        };
      default:
        return {
          backgroundColor: 'rgba(var(--sh-color-warning-rgb), 0.14)',
          color: 'var(--chat-light-text)',
          border: '1px solid rgba(var(--sh-color-warning-rgb), 0.28)',
          boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
        };
    }
  }

  trackMessageByTime(
    index: number,
    message: ChatMessageWithOptionalId
  ): number {
    const timestamp = message.createdAt;
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    return index;
  }

  formatTime(timestamp?: Date): string {
    if (!timestamp) {
      return '';
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getParsedContent(content: string): string {
    if (this.parsedContentCache.has(content)) {
      return this.parsedContentCache.get(content)!;
    }

    // Parse synchronously and cache the result
    const parsed = marked.parse(content);
    if (parsed instanceof Promise) return '';
    this.parsedContentCache.set(content, parsed);
    return parsed;
  }

  private attachScrollListener(): void {
    const element = this.messagesContainer?.nativeElement;
    if (!element || this.scrollListener) {
      return;
    }

    this.scrollListener = () => this.updateScrollButtonVisibility();
    element.addEventListener('scroll', this.scrollListener, { passive: true });
    this.updateScrollButtonVisibility();
  }

  private detachScrollListener(): void {
    const element = this.messagesContainer?.nativeElement;
    if (element && this.scrollListener) {
      element.removeEventListener('scroll', this.scrollListener);
    }
    this.scrollListener = undefined;
  }

  private updateScrollButtonVisibility(): void {
    const element = this.messagesContainer?.nativeElement;
    if (!element) {
      if (this.showScrollToBottomButton) {
        this.showScrollToBottomButton = false;
        this.cdr.markForCheck();
      }
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.clientHeight - element.scrollTop;
    const shouldShow = distanceFromBottom > 48;
    if (this.showScrollToBottomButton !== shouldShow) {
      this.showScrollToBottomButton = shouldShow;
      this.cdr.markForCheck();
    }
  }
}
