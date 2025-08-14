import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit } from '@angular/core';

@Component({
  selector: 'sh-questionflow-top-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './questionflow-top-tracker.component.html',
  styles: [
    `
      @keyframes blink {
        0% {
          opacity: 0.2;
        }
        20% {
          opacity: 1;
        }
        100% {
          opacity: 0.2;
        }
      }
      .loading-dot {
        animation: blink 1.4s infinite both;
      }
      .loading-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      .loading-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
    `,
  ],
})
export class QuestionflowTopTrackerComponent implements OnInit, OnChanges {
  @Input() currentStep = 0;
  @Input() maxLength = 1;
  @Input() questionIndex = 0;

  tracking: number[] = [];

  ngOnInit() {
    this.tracking = Array(this.currentStep + 1).fill(0);
  }

  ngOnChanges(): void {
    this.tracking = Array(this.currentStep + 1).fill(0);
  }

  get boatPosition(): number {
    const progressWidth = (240 / this.maxLength) * this.questionIndex;
    // Subtract 20px to center the boat (40px width / 2)
    return Math.max(0, progressWidth - 20);
  }

  get progressWidth(): number {
    return (240 / this.maxLength) * (this.questionIndex + 1);
  }
}
