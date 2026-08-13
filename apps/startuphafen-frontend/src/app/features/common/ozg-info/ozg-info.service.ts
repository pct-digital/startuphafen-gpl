import { Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';

export interface GemeindeEntry {
  kreis: string;
  gemeinde: string;
  amt: string;
  amtCode: string;
  domain: string | null;
  oeid?: string;
}

export interface UniqueAmt {
  amt: string;
  amtCode: string;
  domain: string | null;
  oeid?: string;
}

export interface OzgConfig {
  enableAmtSelection: boolean;
  isOZGOverriden: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class OzgInfoService {
  private configCache: OzgConfig | null = null;

  constructor(private trpc: TrpcService) {}

  async getConfig() {
    if (this.configCache) {
      return this.configCache;
    }
    this.configCache = await this.trpc.client.OzgInfo.getConfig.query();
    return this.configCache;
  }

  async lookupPlz(plz: string) {
    return this.trpc.client.OzgInfo.lookupPlz.query({ plz });
  }

  async saveForProject(projectId: number, plz: string) {
    return this.trpc.client.OzgInfo.saveForProject.mutate({ projectId, plz });
  }

  async getUniqueAmts(projectId: number): Promise<UniqueAmt[]> {
    return this.trpc.client.OzgInfo.getUniqueAmts.query({ projectId });
  }
}
