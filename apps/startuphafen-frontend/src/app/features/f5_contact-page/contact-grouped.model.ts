import { Contact } from '@startuphafen/startuphafen-common';

export interface ContactGrouped {
  group: string;
  contact: Contact[];
}
