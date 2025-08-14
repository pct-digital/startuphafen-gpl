import { Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import { Contact } from '@startuphafen/startuphafen-common';

@Injectable({
  providedIn: 'root',
})
export class ContactCollectionService {
  constructor(private trpc: TrpcService) {}

  async getContentList(contentName: string) {
    const res: Contact[] = await this.trpc.client.CMS.getContactList.query({
      name: contentName,
    });

    return res;
  }

  getWebsiteText(placeToPutList: string[]) {
    return this.trpc.client.CMS.getWebsiteText.query(placeToPutList);
  }

  async parseImageUrl(contacts: Contact[]) {
    const filledInIcons: Contact[] = [];

    for (const contact of contacts) {
      if (contact.foto == null) {
        filledInIcons.push(contact);
      } else {
        const fotoUrl = await this.trpc.client.CMS.getFileUrl.query(
          contact.foto.url
        );
        contact.foto.url = fotoUrl;
        filledInIcons.push(contact);
      }
    }

    return filledInIcons;
  }
}
