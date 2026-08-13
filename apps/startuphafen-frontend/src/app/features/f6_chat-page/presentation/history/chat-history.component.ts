import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShButtonDirective } from '@startuphafen/angular-common';
import { ChatSession } from '@startuphafen/startuphafen-common';
import { marked } from 'marked';

@Component({
  selector: 'sh-chat-history',
  standalone: true,
  imports: [CommonModule, FormsModule, ShButtonDirective],
  templateUrl: './chat-history.component.html',
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
    `,
  ],
})
export class ChatHistoryComponent {
  @Input() isSessionLoading = false;
  @Input() isSending = false;
  @Input() sessions: ChatSession[] = [];
  @Input() selectedSessionId: number | null = null;
  @Input() editingSessionId: number | null = null;
  @Input() editedTitle = '';
  @Input() sessionPendingDeletion: number | null = null;
  @Input() hasReachedSessionLimit = false;
  @Input() sessionLimit = 0;

  @Output() startNewChat = new EventEmitter<void>();
  @Output() selectSession = new EventEmitter<number>();
  @Output() sessionRenameBegin = new EventEmitter<ChatSession>();
  @Output() editedTitleChange = new EventEmitter<string>();
  @Output() sessionRenameCommit = new EventEmitter<number>();
  @Output() sessionRenameCancel = new EventEmitter<void>();
  @Output() sessionDeleteRequested = new EventEmitter<number>();
  @Output() sessionDeleteConfirmed = new EventEmitter<number>();
  @Output() sessionDeleteCanceled = new EventEmitter<void>();

  private parsedTitleCache = new Map<string, string>();

  onBeginRename(event: MouseEvent, session: ChatSession): void {
    event.stopPropagation();
    this.sessionRenameBegin.emit(session);
  }

  onRenameKey(event: KeyboardEvent, sessionId: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.sessionRenameCommit.emit(sessionId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.sessionRenameCancel.emit();
    }
  }

  onRenameBlur(sessionId: number): void {
    this.sessionRenameCommit.emit(sessionId);
  }

  onDeleteRequested(event: MouseEvent, sessionId: number): void {
    event.stopPropagation();
    this.sessionDeleteRequested.emit(sessionId);
  }

  onDeleteConfirmed(event: MouseEvent | undefined, sessionId: number): void {
    event?.stopPropagation();
    this.sessionDeleteConfirmed.emit(sessionId);
  }

  onDeleteCanceled(event?: MouseEvent): void {
    event?.stopPropagation();
    this.sessionDeleteCanceled.emit();
  }

  onEditedTitleChange(value: string): void {
    this.editedTitleChange.emit(value ?? '');
  }

  trackSessionById(_index: number, session: ChatSession): number {
    return session.id;
  }

  formatSessionTimestamp(date: Date): string {
    return date.toLocaleString('de-DE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getParsedTitle(title: string): string {
    if (this.parsedTitleCache.has(title)) {
      return this.parsedTitleCache.get(title)!;
    }

    // Parse synchronously and cache the result
    const parsed = marked.parse(title ?? '') as string;
    this.parsedTitleCache.set(title, parsed);
    return parsed;
  }
}
