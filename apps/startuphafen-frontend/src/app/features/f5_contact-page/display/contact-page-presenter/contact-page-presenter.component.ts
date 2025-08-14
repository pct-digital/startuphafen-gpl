import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import {
  HlmCardContentDirective,
  HlmCardDirective,
  HlmCardHeaderDirective,
} from '@spartan-ng/ui-card-helm';
import { WebsiteText } from '@startuphafen/startuphafen-common';
import { ContactGrouped } from '../../contact-grouped.model';

@Component({
  selector: 'sh-contact-page-presenter',
  standalone: true,
  imports: [
    CommonModule,
    HlmCardDirective,
    HlmCardHeaderDirective,
    HlmCardContentDirective,
    FormlyModule,
    ReactiveFormsModule,
  ],
  templateUrl: './contact-page-presenter.component.html',
  styles: ``,
})
export class ContactPagePresenterComponent {
  @Input() contactListGrouped: ContactGrouped[] = [];
  @Input() websiteText: WebsiteText[] = [];

  @Output() contactClicked = new EventEmitter<number>();
}
