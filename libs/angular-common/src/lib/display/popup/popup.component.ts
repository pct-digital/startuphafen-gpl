import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
} from '@angular/core';

@Component({
  selector: 'sh-project-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './popup.component.html',
  styles: `
    .popup-container::-webkit-scrollbar {
      display: none;
    }
    
    .popup-container {
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE and Edge */
    }
  `,
})
export class PopupComponent {
  @Input() width?: number;
  @Input() height?: number;
  @Input() content?: TemplateRef<any>;
  @Input() context?: any;

  @Output() closeEvent = new EventEmitter();

  close() {
    this.closeEvent.emit();
  }
}
