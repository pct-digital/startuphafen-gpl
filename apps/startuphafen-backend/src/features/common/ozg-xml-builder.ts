import {
  FormDataNode,
  OZGAntragsteller,
} from '@startuphafen/startuphafen-common';
import { XMLBuilder } from 'fast-xml-parser';
import { jwtDecode } from 'jwt-decode';

export function buildOzgXml(params: {
  formData: FormDataNode[];
  antragsteller: OZGAntragsteller;
  organisationsEinheitenId: string;
  inboxReference: string;
}) {
  const builder = new XMLBuilder();
  const xmlObject = {
    myForm: {
      OrganisationseinheitenID: params.organisationsEinheitenId,
      inbox_reference: params.inboxReference,
      antragsteller: params.antragsteller,
      formData: params.formData,
    },
  };

  return builder.build(xmlObject);
}

export function buildTokenXml(token: string) {
  const builder = new XMLBuilder();
  const xmlObject = {
    token: { raw: token, decoded: jwtDecode(token) },
  };

  return builder.build(xmlObject);
}
