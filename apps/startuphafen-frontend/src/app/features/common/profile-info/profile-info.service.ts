import { Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';

export interface ProfileInfoInput {
  phoneInternational: string;
  phoneNational: string;
  phoneNumber: string;
  website: string | null;
  birthCountry: string;
  birthPlace: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileInfoService {
  constructor(private trpc: TrpcService) {}

  async create(input: ProfileInfoInput) {
    return this.trpc.client.ProfileInfo.create.mutate(input);
  }

  async get() {
    return this.trpc.client.ProfileInfo.get.query();
  }
}
