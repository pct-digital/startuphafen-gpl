import {
  EricHandleProcessInput,
  EricToolInterface,
} from '@startuphafen/startuphafen-common';
import axios, { AxiosInstance } from 'axios';
import { LocalSecrets, ServerConfig } from '../../config';

export class EricTool implements EricToolInterface {
  token = {};
  axi: AxiosInstance;

  constructor(
    private serverConfig: ServerConfig,
    private localSecrets: LocalSecrets
  ) {
    this.axi = axios.create({
      baseURL: this.localSecrets.eric.host,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.localSecrets.eric.token,
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
      }

      const res = (
        await this.axi.post('/makeEricCall', input, {
          responseType: 'json',
        })
      ).data;
      return res;
    } catch (e: any) {
      console.error(e);
    }
  }
}
