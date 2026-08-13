import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ShButtonDirective,
  ShCardDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
  ShInputDirective,
  TrpcService,
} from '@startuphafen/angular-common';

@Component({
  selector: 'sh-feedback',
  standalone: true,
  imports: [
    CommonModule,
    ShCardDirective,
    ShCardTitleDirective,
    ShCardSubtitleDirective,
    ShButtonDirective,
    ShInputDirective,
    FormsModule,
  ],
  templateUrl: './feedback.component.html',
})
export class FeedbackComponent {
  @Output() close = new EventEmitter<void>();

  selectedEmoji: number | null = null;
  message = '';

  emojis = [
    {
      value: '😢',
      text: 'Schlecht',
    },
    {
      value: '😔',
      text: 'Nicht Gut',
    },
    {
      value: '😑',
      text: 'In Ordnung',
    },
    {
      value: '🙂',
      text: 'Gut',
    },
    {
      value: '🥰',
      text: 'Sehr Gut',
    },
  ];

  constructor(private trpc: TrpcService) {}

  submit() {
    this.trpc.client.Feedback.create
      .mutate({
        selection: this.selectedEmoji!,
        message: this.message,
      })
      .then(
        () => this.close.emit(),
        (error: Error) => {
          console.error(error);
        }
      );
  }
}
