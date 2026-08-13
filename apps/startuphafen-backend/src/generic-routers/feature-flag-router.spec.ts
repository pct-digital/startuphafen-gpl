import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  FeatureFlag,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../assets-loader';
import { buildFeatureFlagRouter } from './feature-flag-router';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();
const now = new Date('2026-04-08T00:00:00.000Z');
const createToken = (roles: string[]) => ({
  sub: 'test-user',
  realm_access: {
    roles,
  },
});

describe('featureFlagRouter', () => {
  const createTrxFactory = (): TransactionFactory => {
    return async (work, readOnly) => {
      return await postgres.knex.transaction(async (trx) => await work(trx), {
        isolationLevel: 'serializable',
        readOnly,
      });
    };
  };

  const createCaller = (roles: string[] = ['anon']) => {
    return buildFeatureFlagRouter().createCaller({
      trxFactory: createTrxFactory(),
      token: createToken(roles),
    });
  };

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
          description: 'Should not be exposed',
          updatedBy: 'tester-a',
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'alpha-flag',
          enabled: true,
          description: 'Should not be exposed either',
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

  it('returns feature flags ordered by name and only exposes public fields', async () => {
    const result = await createCaller().getFeatureFlags();

    expect(result).toEqual(
      expect.arrayContaining([
        {
          name: 'alpha-flag',
          enabled: true,
        },
        {
          name: 'zeta-flag',
          enabled: false,
        },
      ])
    );

    expect(result.map((featureFlag) => featureFlag.name)).toEqual(
      [...result.map((featureFlag) => featureFlag.name)].sort()
    );

    expect(
      result.every((featureFlag) => Object.keys(featureFlag).length === 2)
    ).toBe(true);

    expect(result.every((featureFlag) => 'name' in featureFlag)).toBe(true);
    expect(result.every((featureFlag) => 'enabled' in featureFlag)).toBe(true);

    expect(result).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.anything(),
        }),
        {
          updatedBy: expect.anything(),
        },
        {
          createdAt: expect.any(Date),
        },
        {
          updatedAt: expect.any(Date),
        },
      ])
    );
  });

  it('records the audit actor (token sub) when an admin toggles a flag', async () => {
    await createCaller(['startuphafen-admin']).setFeatureFlagState({
      name: 'zeta-flag',
      enabled: true,
    });

    const zeta = (
      await createCaller(['startuphafen-admin']).getAdminFeatureFlags()
    ).find((f) => f.name === 'zeta-flag');

    // For a Keycloak admin with no name claims this must be the sub, never ' '.
    expect(zeta?.updatedBy).toBe('test-user');
    expect(zeta?.enabled).toBe(true);
  });

  it('returns admin feature flags with admin-only metadata', async () => {
    const result = await createCaller([
      'startuphafen-admin',
    ]).getAdminFeatureFlags();

    expect(
      result.filter(
        (featureFlag) =>
          featureFlag.name === 'alpha-flag' || featureFlag.name === 'zeta-flag'
      )
    ).toEqual([
      {
        name: 'alpha-flag',
        enabled: true,
        description: 'Should not be exposed either',
        updatedAt: now,
        updatedBy: 'tester-b',
      },
      {
        name: 'zeta-flag',
        enabled: false,
        description: 'Should not be exposed',
        updatedAt: now,
        updatedBy: 'tester-a',
      },
    ]);
  });
});
