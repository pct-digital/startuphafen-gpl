import { inject, Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import { LoginPageTexts } from '@startuphafen/startuphafen-common';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private trpc = inject(TrpcService);

  async getRedirectHost() {
    return this.trpc.client.Login.loadRedirectHost.query();
  }

  async getText() {
    return (await this.trpc.client.CMS.getSingleTypeData.query(
      'login-page-text'
    )) as LoginPageTexts;
  }
}
