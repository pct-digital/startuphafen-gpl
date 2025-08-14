import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { WebsiteText } from '@startuphafen/startuphafen-common';
import { ContactGrouped } from '../../contact-grouped.model';
import { ContactPagePresenterComponent } from './contact-page-presenter.component';

describe('ContactPagePresenterComponent', () => {
  let spectator: Spectator<ContactPagePresenterComponent>;
  const createComponent = createComponentFactory({
    component: ContactPagePresenterComponent,
  });

  const mockWebsiteText: WebsiteText[] = [
    {
      id: 1,
      title: 'Contact Us',
      text: 'Get in touch with our team',
      placeToPut: 'contact-page-title',
    },
  ];

  const mockContactListGrouped: ContactGrouped[] = [
    {
      group: 'Gründungslotsen',
      contact: [
        {
          name: 'John Doe',
          funktion: 'Manager',
          unternehmen: 'Acme Inc',
          mailadresse: 'john@example.com',
          telefon: '+123456789',
          kontaktlink: 'https://example.com',
          group: 'Gründungslotsen',
          foto: {
            url: 'https://example.com/profile.jpg',
          },
        },
      ],
    },
  ];

  it('should create', () => {
    spectator = createComponent({
      props: {
        websiteText: mockWebsiteText,
        contactListGrouped: mockContactListGrouped,
      },
    });

    expect(spectator.component).toBeTruthy();
  });

  it('should have a title', () => {
    spectator = createComponent({
      props: {
        websiteText: mockWebsiteText,
        contactListGrouped: mockContactListGrouped,
      },
    });

    expect(spectator.query(byTestId('contact-page-title'))).toExist();
    expect(spectator.query(byTestId('contact-page-title'))).toHaveText(
      'Contact Us'
    );
  });
});
