import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  PopupService,
  ShButtonDirective,
  ShCardDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
} from '@startuphafen/angular-common';
import { Contact } from '@startuphafen/startuphafen-common';
import { Subject, takeUntil } from 'rxjs';
import { ContactCollectionService } from '../contact-collection/contact-collection.service';
import { FeedbackComponent } from '../feedback/feedback.component';

@Component({
  selector: 'sh-questionflow-top-tracker',
  standalone: true,
  imports: [
    CommonModule,
    ShCardDirective,
    ShCardTitleDirective,
    ShCardSubtitleDirective,
    ShButtonDirective,
    FeedbackComponent,
  ],
  templateUrl: './questionflow-top-tracker.component.html',
  styles: [
    `
      .acrylic {
        background-color: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(10px);
      }
      .progress-bar-fill {
        transition: width 0.5s ease-in-out;
      }
      .progress-boat {
        transition: left 0.5s ease-in-out;
      }
    `,
  ],
})
export class QuestionflowTopTrackerComponent implements OnInit {
  @Input() projectName = '';
  @Input() currentStepIndex = 0;
  @Input() stepsLength = 0;
  @Input() stepsLabel = '';

  //region popup
  contact: Contact | null = null;
  //endregion

  constructor(
    private contactService: ContactCollectionService,
    private router: Router,
    private popup: PopupService
  ) {}

  async ngOnInit() {
    this.contact = await this.loadContact();
  }

  get progressPercent(): number {
    return ((this.currentStepIndex + 1) / this.stepsLength) * 100;
  }

  //region PopUp
  async routeToFAQ() {
    await this.router.navigateByUrl('/faqPage');
    await this.close();
  }

  async loadContact() {
    const contacts: Contact[] = await this.contactService.parseImageUrl(
      (
        await this.contactService.getContactsUniversal()
      ).filter((c) => c.group === 'Gründungslotsen')
    );
    if (contacts.length === 0) return null;
    if (contacts.length === 1) return contacts[0];
    return contacts[Math.floor(Math.random() * (contacts.length - 1)) + 1];
  }

  @ViewChild('ContactInfo', { static: true })
  contactInfoTemplate?: TemplateRef<any>;

  @ViewChild('Feedback', { static: true })
  feedbackTemplate?: TemplateRef<any>;

  private destroy$ = new Subject<void>();

  async close() {
    this.popup.closePopup();
  }

  openContactPopup() {
    this.openPopup(this.contactInfoTemplate);
  }

  openFeedbackPopup() {
    this.openPopup(this.feedbackTemplate);
  }

  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popup
        .open(popupTemplate)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }
  }
  //endregion
}
