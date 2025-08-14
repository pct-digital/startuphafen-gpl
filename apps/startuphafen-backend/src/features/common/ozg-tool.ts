import {
  FormDataNode,
  OZGFormDataRequest,
  OZGInterface,
} from '@startuphafen/startuphafen-common';
import { generateUUID } from '@startuphafen/utility';
import axios, { AxiosInstance } from 'axios';
import { LocalSecrets } from '../../config';

export class OZGTool implements OZGInterface {
  axi: AxiosInstance;
  antragEndPoint = '/antrag';

  control = {} as LocalSecrets['ozg']['control'];

  constructor(localConfig: LocalSecrets) {
    this.axi = axios.create({
      baseURL: localConfig.ozg.host,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    this.control = { ...localConfig.ozg.control };
  }

  private getControl() {
    return {
      transactionId: generateUUID(),
      ...this.control,
    };
  }

  async postOZGFormData(formData: FormDataNode[], attachment?: string) {
    try {
      const multipartForm = new FormData();

      const ozgInput: OZGFormDataRequest = {
        control: this.getControl(),
        formData: formData,
      };

      const formDataBlob = new Blob([JSON.stringify(ozgInput)], {
        type: 'application/json',
      });

      multipartForm.append('formData', formDataBlob);

      if (attachment) {
        const attachmentBlob = new Blob([attachment], {
          type: 'application/xml',
        });

        multipartForm.append('attachment', attachmentBlob, 'attachment.xml');
      }

      const response = await this.axi.post(this.antragEndPoint, multipartForm);

      return response.data;
    } catch (error: any) {
      console.log(error.message);
      throw new Error(`Failed to post OZG form data: ${error.message}`);
    }
  }
}
