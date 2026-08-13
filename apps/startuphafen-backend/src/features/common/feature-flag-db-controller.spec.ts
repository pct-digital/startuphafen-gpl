import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import {
  FeatureFlag,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { FeatureFlagDbController } from './feature-flag-db-controller';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

describe('FeatureFlagDbController', () => {
  const now = new Date('2026-04-08T00:00:00.000Z');

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);

    await postgres
      .knex<FeatureFlag>(STARTUPHAFENBACKEND_TABLES.FEATUREFLAG)
      .insert([
        {
          name: 'zeta-flag',
          enabled: false,
          description: 'Should stay admin-only',
          updatedBy: 'tester-a',
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'alpha-flag',
          enabled: true,
          description: 'Should also stay admin-only',
          updatedBy: 'tester-b',
          createdAt: now,
          updatedAt: now,
        },
      ]);

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('returns existing flag by name', async () => {
    const flag = await postgres.knex.transaction(async (trx) => {
      return new FeatureFlagDbController(trx).getByName('alpha-flag');
    });

    expect(flag).toBeDefined();
    expect(flag?.name).toBe('alpha-flag');
    expect(flag?.enabled).toBe(true);
  });

  it('returns undefined for missing flag', async () => {
    const flag = await postgres.knex.transaction(async (trx) => {
      return new FeatureFlagDbController(trx).getByName('does-not-exist');
    });

    expect(flag).toBeUndefined();
  });

  it('returns public feature flags ordered by name without admin metadata', async () => {
    const flags = await postgres.knex.transaction(async (trx) => {
      return new FeatureFlagDbController(trx).getPublicFeatureFlags();
    });

    expect(
      flags.filter(
        (featureFlag) =>
          featureFlag.name === 'alpha-flag' || featureFlag.name === 'zeta-flag'
      )
    ).toEqual([
      {
        name: 'alpha-flag',
        enabled: true,
      },
      {
        name: 'zeta-flag',
        enabled: false,
      },
    ]);
  });

  it('returns admin feature flags ordered by name with admin metadata', async () => {
    const flags = await postgres.knex.transaction(async (trx) => {
      return new FeatureFlagDbController(trx).getAdminFeatureFlags();
    });

    expect(
      flags.filter(
        (featureFlag) =>
          featureFlag.name === 'alpha-flag' || featureFlag.name === 'zeta-flag'
      )
    ).toEqual([
      {
        name: 'alpha-flag',
        enabled: true,
        description: 'Should also stay admin-only',
        updatedAt: now,
        updatedBy: 'tester-b',
      },
      {
        name: 'zeta-flag',
        enabled: false,
        description: 'Should stay admin-only',
        updatedAt: now,
        updatedBy: 'tester-a',
      },
    ]);
  });

  it('updates the feature flag state and audit fields', async () => {
    await postgres.knex.transaction(async (trx) => {
      await new FeatureFlagDbController(trx).updateFeatureFlagState({
        name: 'alpha-flag',
        enabled: false,
        updatedBy: 'admin-user',
      });
    });

    const flag = await postgres.knex.transaction(async (trx) => {
      return new FeatureFlagDbController(trx).getByName('alpha-flag');
    });

    expect(flag?.enabled).toBe(false);
    expect(flag?.updatedBy).toBe('admin-user');
    expect(flag?.updatedAt).toBeInstanceOf(Date);
  });
});
