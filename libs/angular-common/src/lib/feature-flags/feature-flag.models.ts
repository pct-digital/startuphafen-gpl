import { FeatureFlag } from '@startuphafen/startuphafen-common';

export type FeatureFlagAdminItem = Pick<
  FeatureFlag,
  'name' | 'enabled' | 'description' | 'updatedAt' | 'updatedBy'
>;
