import { Injectable, inject } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import { ChatMessage, ChatSession } from '@startuphafen/startuphafen-common';
import { Observable, catchError, from, map, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private trpcService = inject(TrpcService);

  listSessions(): Observable<ChatSession[]> {
    return from(this.trpcService.client.ChatBot.listSessions.query()).pipe(
      catchError((error) => {
        console.error('Failed to load chat sessions', error);
        return throwError(() => error);
      })
    );
  }

  createSession(title?: string): Observable<ChatSession> {
    return from(
      this.trpcService.client.ChatBot.createSession.mutate(
        title ? { title } : {}
      )
    ).pipe(
      catchError((error) => {
        console.error('Failed to create chat session', error);
        return throwError(() => error);
      })
    );
  }

  renameSession(sessionId: number, title: string): Observable<ChatSession> {
    return from(
      this.trpcService.client.ChatBot.renameSession.mutate({
        sessionId,
        title,
      })
    ).pipe(
      catchError((error) => {
        console.error('Failed to rename chat session', error);
        return throwError(() => error);
      })
    );
  }

  deleteSession(sessionId: number): Observable<void> {
    return from(
      this.trpcService.client.ChatBot.deleteSession.mutate({ sessionId })
    ).pipe(
      map(() => void 0),
      catchError((error) => {
        console.error('Failed to delete chat session', error);
        return throwError(() => error);
      })
    );
  }

  loadMessages(sessionId: number): Observable<ChatMessage[]> {
    return from(
      this.trpcService.client.ChatBot.getMessages.query({ sessionId })
    ).pipe(
      map((messages) =>
        messages.map((message) => this.normalizeMessage(message))
      ),
      catchError((error) => {
        console.error('Failed to load chat messages', error);
        return throwError(() => error);
      })
    );
  }

  sendMessage(
    sessionId: number | null,
    message: string
  ): Observable<{ session: ChatSession; messages: ChatMessage[] }> {
    return from(
      this.trpcService.client.ChatBot.sendMessage.mutate({
        sessionId: sessionId ?? undefined,
        message,
      })
    ).pipe(
      map((response) => ({
        session: this.normalizeSession(response.session),
        messages: response.messages.map((message) =>
          this.normalizeMessage(message)
        ),
      })),
      catchError((error) => {
        console.error('Failed to send chat message', error);
        return throwError(() => error);
      })
    );
  }

  private normalizeSession(session: ChatSession): ChatSession {
    return {
      ...session,
      createdAt: this.toDate(session.createdAt),
      updatedAt: this.toDate(session.updatedAt),
      deletedAt: this.toOptionalDate(session.deletedAt),
    };
  }

  private normalizeMessage(message: ChatMessage): ChatMessage {
    return {
      ...message,
      createdAt: this.toDate(message.createdAt),
    };
  }

  private toOptionalDate(value: Date | string | null | undefined): Date | null {
    if (value == null) {
      return null;
    }
    return this.toDate(value);
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }
}
