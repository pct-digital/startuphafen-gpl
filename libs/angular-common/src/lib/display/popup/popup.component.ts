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
  styles: ``,
})
export class PopupComponent {
  @Input() title? = '';
  @Input() width?: number;
  @Input() height?: number;
  @Input() content?: TemplateRef<any>;
  @Input() context?: any;

  @Output() closeEvent = new EventEmitter();
  @Output() createEvent = new EventEmitter();

  constructor() {}

  close() {
    this.closeEvent.emit();
  }

  create() {
    this.createEvent.emit();
  }
}
