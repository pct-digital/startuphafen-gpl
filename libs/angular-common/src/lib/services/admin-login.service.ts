import { Injectable, inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { NavService } from '../services/path.service';
import { TrpcService } from './trpc.service';

interface AdminLoginOptions {
  idpHint: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AdminLoginService {
  private readonly keycloak = inject(KeycloakService);
  private readonly nav = inject(NavService);
  private readonly trpc = inject(TrpcService);

  private options: AdminLoginOptions | null = null;

  private async loadOptions(): Promise<AdminLoginOptions> {
    if (this.options) {
      return this.options;
    }

    this.options = await this.trpc.client.Login.loadAdminLoginOptions.query(
      undefined
    );
    return this.options;
  }

  async loginThroughKeycloak(): Promise<void> {
    const options = await this.loadOptions();
    const redirectUri = `${window.location.origin}${this.nav.adminPage()}`;

    await this.keycloak.login({
      redirectUri,
      prompt: 'login',
      idpHint: options.idpHint ?? undefined,
    });
  }
}
