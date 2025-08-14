import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ShButtonDirective,
  ShCardContentDirective,
  ShCardDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
} from '@startuphafen/angular-common';

@Component({
  selector: 'sh-send-application',
  standalone: true,
  imports: [
    CommonModule,
    ShButtonDirective,
    ShCardDirective,
    ShCardSubtitleDirective,
    ShCardTitleDirective,
    ShCardContentDirective,
  ],
  templateUrl: './send-application.component.html',
  styles: `

  @media screen and (max-width: 768px) {
    .error-mobile{
      transform: scale(1);
    }
  }
  
  .filter-green{
    filter: invert(89%) sepia(30%) saturate(5792%) hue-rotate(61deg) brightness(83%) contrast(82%);
}
  `,
})
export class SendApplicationComponent {
  @Input() applicationType: 'elster' | 'gewerbeamt' | null = null;
  @Input() sendDisabled = false;
  @Input() lockSend = false;
  @Input() downloadDisabled = false;
  @Input() downloadVisible = true;

  @Input() content: string | null = null;
  @Input() title: string | null = null;
  @Input() subtitle: string | null = null;
  @Input() errorCardTitle: string | null = null;
  @Input() errorMessage: string[] | null = null;

  @Output() sendData = new EventEmitter<void>();
  @Output() downloadData = new EventEmitter<void>();

  clickSend() {
    this.sendData.emit();
  }

  clickDownloadData() {
    this.downloadData.emit();
  }
}
