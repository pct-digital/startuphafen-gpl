import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import { Contact, WebsiteText } from '@startuphafen/startuphafen-common';
import { ContactGrouped } from '../../contact-grouped.model';
import { ContactPagePresenterComponent } from '../../display/contact-page-presenter/contact-page-presenter.component';
import { ContactCollectionService } from '../../services/contact-collection/contact-collection.service';

@Component({
  selector: 'sh-contact-page-container',
  standalone: true,
  imports: [
    CommonModule,
    ContactPagePresenterComponent,
    ReactiveFormsModule,
    FormlyModule,
  ],
  templateUrl: './contact-page-container.component.html',
  styles: ``,
})
export class ContactPageContainerComponent implements OnInit {
  contactList: Contact[] = [];
  contactListGrouped: ContactGrouped[] = [];
  websiteText: WebsiteText[] = [];

  constructor(private contactCollectionService: ContactCollectionService) {}

  async ngOnInit() {
    await this.loadContactCollection();
    this.createGroupedContacts();
    this.websiteText = await this.contactCollectionService.getWebsiteText([
      'netzwerk',
    ]);
  }

  async loadContactCollection() {
    try {
      this.contactList = await this.contactCollectionService.getContentList(
        'contacts'
      );
      this.contactList = await this.contactCollectionService.parseImageUrl(
        this.contactList
      );
    } catch (error) {
      this.contactList = [];
    }
  }

  createGroupedContacts() {
    const sort = ['Gründungslotsen', 'Weitere Beratungsangebote'];
    const uniqueGroups = [
      ...new Set(this.contactList?.map((contact) => contact.group)),
    ];

    uniqueGroups.sort((a, b) => {
      const indexA = sort.indexOf(a);
      const indexB = sort.indexOf(b);

      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });

    for (const uniqueGroup of uniqueGroups) {
      this.contactListGrouped.push({
        group: uniqueGroup,
        contact: this.contactList.filter(
          (contact) => contact.group === uniqueGroup
        ),
      });
    }
  }
}
