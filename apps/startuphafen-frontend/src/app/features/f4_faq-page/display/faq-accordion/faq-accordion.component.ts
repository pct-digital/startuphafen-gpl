import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { Faq, FAQItem } from '@startuphafen/startuphafen-common';
import { marked } from 'marked';

@Component({
  selector: 'sh-faq-accordion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq-accordion.component.html',
  animations: [
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '0',
          opacity: '0',
          overflow: 'hidden',
          padding: '0',
        })
      ),
      state(
        'expanded',
        style({
          height: '*',
          opacity: '1',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          borderRadius: '0.85rem',
        })
      ),
      transition('collapsed <=> expanded', [animate('200ms ease-in-out')]),
    ]),
  ],
  styles: ``,
})
export class FaqAccordionComponent implements OnInit {
  @Input() isPopup = false;
  @Input() faqList: FAQItem[] = [];

  faqs: Faq[] = [];

  async ngOnInit() {
    this.faqs = await Promise.all(
      this.faqList.map(async (faq) => ({
        header: faq.question ?? '',
        content: await marked.parse(faq.answer ?? ''),
        isOpen: false,
      }))
    );
  }

  toggleFaq(faq: Faq) {
    faq.isOpen = !faq.isOpen;
  }
}
