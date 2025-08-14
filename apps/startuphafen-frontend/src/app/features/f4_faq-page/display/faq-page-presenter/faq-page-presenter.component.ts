import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { NgSelectModule } from '@ng-select/ng-select';

import {
  ArticleCategory,
  Artikel,
  FAQItem,
} from '@startuphafen/startuphafen-common';
import { FaqAccordionComponent } from '../faq-accordion/faq-accordion.component';

@Component({
  selector: 'sh-faq-page-presenter',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectModule,
    FaqAccordionComponent,
  ],
  templateUrl: './faq-page-presenter.component.html',
  providers: [provideIcons({ lucideSearch })],
  styles: ``,
})
export class FaqPagePresenterComponent {
  @Input() isPopup = false;
  @Input() faqList: FAQItem[] = [];

  @Input() articleSearchResults: Artikel[] = [];
  @Input() isArticleSearch = false;
  @Input() isArticleNotFound = false;

  @Input() articles: Artikel[] = [];

  @Input() categories: ArticleCategory[] = [];

  @Output() articleClicked = new EventEmitter<string | number>();
  @Output() articleCategorieChanged = new EventEmitter<string[]>();
  @Output() searchSubmit = new EventEmitter<any>();

  faqFormGroup: FormGroup;

  constructor(private fb: FormBuilder) {
    this.faqFormGroup = this.fb.group({
      search: new FormControl(''),
    });
  }

  submit() {
    this.searchSubmit.emit(this.faqFormGroup.value);
  }
}
