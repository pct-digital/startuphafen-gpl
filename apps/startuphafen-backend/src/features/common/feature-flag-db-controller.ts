import {
  FeatureFlag,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

type PublicFeatureFlag = Pick<FeatureFlag, 'name' | 'enabled'>;

type AdminFeatureFlag = Pick<
  FeatureFlag,
  'name' | 'enabled' | 'description' | 'updatedAt' | 'updatedBy'
>;

export class FeatureFlagDbController {
  constructor(private trx: Knex.Transaction) {}

  async getByName(name: string) {
    return this.trx<FeatureFlag>(STARTUPHAFENBACKEND_TABLES.FEATUREFLAG)
      .where({ name })
      .first();
  }

  async getPublicFeatureFlags(): Promise<PublicFeatureFlag[]> {
    return this.trx<FeatureFlag>(STARTUPHAFENBACKEND_TABLES.FEATUREFLAG)
      .select('name', 'enabled')
      .orderBy('name');
  }

  async getAdminFeatureFlags(): Promise<AdminFeatureFlag[]> {
    return this.trx<FeatureFlag>(STARTUPHAFENBACKEND_TABLES.FEATUREFLAG)
      .select('name', 'enabled', 'description', 'updatedAt', 'updatedBy')
      .orderBy('name');
  }

  async updateFeatureFlagState(params: {
    name: string;
    enabled: boolean;
    updatedBy: string | null;
  }): Promise<number> {
    return this.trx<FeatureFlag>(STARTUPHAFENBACKEND_TABLES.FEATUREFLAG)
      .where({ name: params.name })
      .update({
        enabled: params.enabled,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      });
  }
}
