import { inject, Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private trpc = inject(TrpcService);

  async getRedirectHost() {
    try {
      const host = await this.trpc.client.Login.loadRedirectHost.query();
      return host;
    } catch (error) {
      console.error(error);

      throw error;
    }
  }

  async getText() {
    try {
      const text = await this.trpc.client.CMS.getLoginText.query();
      return text;
    } catch (error) {
      console.error(error);

      throw error;
    }
  }
}
