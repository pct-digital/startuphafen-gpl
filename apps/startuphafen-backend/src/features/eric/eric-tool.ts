import {
  EricHandleProcessInput,
  EricToolInterface,
} from '@startuphafen/startuphafen-common';
import axios, { AxiosInstance } from 'axios';
import { ServerConfig } from '../../config';

export class EricTool implements EricToolInterface {
  axi: AxiosInstance;

  constructor(private serverConfig: ServerConfig) {
    this.axi = axios.create({
      baseURL: this.serverConfig.eric.host,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.serverConfig.eric.token,
      },
    });
  }

  async makeEricCall(input: EricHandleProcessInput) {
    try {
      if (this.serverConfig.eric.devMode) {
        input = {
          ...input,
          xmlData: input.xmlData.replace(
            '{{TESTMERKER}}',
            '<Testmerker>700000004</Testmerker>'
          ),
        };

        if (!input.xmlData.includes('Testmerker'))
          throw new Error('Testmerker was not set while in dev mode!');

        console.log('Eric is making a call with test flag set!');
      } else {
        console.log(
          'Eric is making a call WITHOUT test flag set, REAL company will be created!'
        );
      }

      const res = (
        await this.axi.post('/makeEricCall', input, {
          responseType: 'json',
        })
      ).data;

      return res;
    } catch (e: any) {
      // Extract only essential error info to avoid logging megabytes of circular references
      const errorLog = {
        message: e.message,
        code: e.code,
        status: e.response?.status,
        statusText: e.response?.statusText,
        url: e.config?.url,
      };

      console.error('[EricTool] Error:', errorLog);
    }
  }
}
