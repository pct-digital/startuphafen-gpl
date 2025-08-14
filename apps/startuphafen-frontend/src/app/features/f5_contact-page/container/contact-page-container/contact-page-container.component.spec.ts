import {
  Spectator,
  byTestId,
  createComponentFactory,
  mockProvider,
} from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import { TrpcService } from '@startuphafen/angular-common';
import { Contact, WebsiteText } from '@startuphafen/startuphafen-common';
import { ContactPagePresenterComponent } from '../../display/contact-page-presenter/contact-page-presenter.component';
import { ContactCollectionService } from '../../services/contact-collection/contact-collection.service';
import { ContactPageContainerComponent } from './contact-page-container.component';

describe('ContactPageContainerComponent', () => {
  let spectator: Spectator<ContactPageContainerComponent>;

  const mockContacts: Contact[] = [
    {
      group: 'testGroup',
      name: 'testName',
      unternehmen: 'testCompany',
      mailadresse: 'testMail',
      telefon: 'testTelefon',
      funktion: 'testFunktion',
      foto: '',
      kontaktlink: null,
    },
  ];

  const mockWebsiteText: WebsiteText[] = [
    {
      id: 0,
      placeToPut: 'netzwerk',
      text: 'testText',
      title: 'test',
      extraLabel: 'test',
      icon: 'test',
    },
  ];

  const createComponent = createComponentFactory({
    component: ContactPageContainerComponent,
    imports: [
      FormlyModule.forRoot({
        types: [],
      }),
      ContactPagePresenterComponent,
    ],
    providers: [
      mockProvider(TrpcService, {
        client: {
          CMS: {
            getContentList: {
              query: jest.fn().mockResolvedValue(mockContacts),
            },
          },
        },
      }),
      mockProvider(ContactCollectionService, {
        getWebsiteText: jest.fn().mockResolvedValue(mockWebsiteText),
        getContentList: jest.fn().mockResolvedValue(mockContacts),
        parseImageUrl: jest.fn().mockResolvedValue(mockContacts),
      }),
    ],
    shallow: true,
  });

  beforeEach(async () => {
    spectator = createComponent({ detectChanges: false });

    spectator.component.websiteText = mockWebsiteText;
    spectator.component.contactList = mockContacts;

    await spectator.fixture.whenStable();
    spectator.detectChanges();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should have a title', () => {
    expect(spectator.query(byTestId('contact-page-title'))).toExist();
  });

  it('should have contactItems', async () => {
    await spectator.component.ngOnInit();
    spectator.detectChanges();

    expect(spectator.component.contactList).toBeDefined();
    expect(spectator.component.contactList.length).toBeGreaterThan(0);
  });
});
