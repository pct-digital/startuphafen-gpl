import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ShButtonDirective,
  ShCardContentDirective,
  ShCardDirective,
  ShCardInnerDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
} from '@startuphafen/angular-common';

@Component({
  selector: 'sh-login-display',
  standalone: true,
  imports: [
    CommonModule,
    ShCardDirective,
    ShCardTitleDirective,
    ShCardSubtitleDirective,
    ShCardInnerDirective,
    ShCardContentDirective,
    ShButtonDirective,
  ],
  templateUrl: './login-display.component.html',
  styles: ``,
})
export class LoginDisplayComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() content = '';
  @Input() loginButton = '';
  @Input() registerButton = '';

  @Output() login = new EventEmitter<void>();
  @Output() register = new EventEmitter<void>();

  onLogin() {
    this.login.emit();
  }

  onRegister() {
    this.register.emit();
  }
}
