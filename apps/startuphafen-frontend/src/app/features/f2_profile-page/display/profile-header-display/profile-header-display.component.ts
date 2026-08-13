import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ProfileInfo, ShUser } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-profile-header-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-header-display.component.html',
  styles: ``,
})
export class ProfileHeaderDisplayComponent {
  @Input() profile: Partial<ShUser> = {};
  @Input() profileInfo: Partial<ProfileInfo> = {};

  get formattedPhoneNumber() {
    if (this.profileInfo.phoneInternational && this.profileInfo.phoneNational && this.profileInfo.phoneNumber) {
      return `${this.profileInfo.phoneInternational} ${this.profileInfo.phoneNational} ${this.profileInfo.phoneNumber}`;
    }
    return '';
  }
}
