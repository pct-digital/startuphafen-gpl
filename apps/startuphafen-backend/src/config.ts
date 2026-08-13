import { FinanzaemterSchema } from '@startuphafen/startuphafen-common';
import { KeycloakAccessConfigSchema } from '@startuphafen/trpc-root';
import {
  CONFIG_TYPE,
  CONFIG_TYPE_SCHEMA,
  ConfigLoader,
} from '@startuphafen/utility-server';
import { WatermarkSchema } from '@startuphafen/watermark/server';
import { z } from 'zod';

export const ConfigSchema = z.object({
  configType: CONFIG_TYPE_SCHEMA.nullable().default(null),
  express: z.object({
    host: z.string().ip(),
    port: z.number().gte(0).lte(65_535),
  }),
  knex: z.object({
    client: z.string().min(1),
    connection: z.object({
      host: z.string(),
      port: z.number().gte(0).lte(65_535),
      user: z.string().min(1),
      database: z.string().min(1),
      password: z.string().min(1),
    }),
    asyncStackTraces: z.boolean().optional(),
  }),
  mail: z.object({
    host: z.string(),
    port: z.number().gte(0).lte(65_535),
    user: z.string(),
    password: z.string(),
    from: z.string().optional(),
    hwkRecipient: z.string().min(1),
    disableHwkDelivery: z.boolean().default(false),
    noSSL: z.boolean().optional(),
    supportRecipient: z.string().min(1),
    feedbackRecipient: z.string().min(1),
    supportCC: z.string(),
  }),
  allowedOrigins: z.array(z.string()),
  keycloak: KeycloakAccessConfigSchema,
  matchingStrapi: z.object({ url: z.string() }),
  watermarkConfig: WatermarkSchema,
  eric: z.object({
    placeholder: z.string().nullable().default(null),
    devMode: z.boolean().default(true),
    host: z.string().default(''),
    token: z.string().default(''),
    finanzaemter: FinanzaemterSchema.default([]),
  }),
  strapi: z
    .object({
      host: z.string().default(''),
      token: z.string().default(''),
    })
    .default({}),
  ozg: z.object({
    placeholder: z.string().nullable().default(null),
    host: z.string().default(''),
    useStagingDomain: z.boolean().default(true),
    enableAmtSelection: z.boolean().default(false),
    globalOverride: z
      .object({
        domain: z.string().trim().min(1),
        oeid: z.string().trim().min(1),
      })
      .nullable()
      .default(null),
    control: z
      .object({
        zustaendigeStelle: z.string().default(''),
        organisationsEinheitenId: z.string().default(''),
        leikaIds: z.array(z.string()).default([]),
        formId: z.string().default(''),
        name: z.string().default(''),
        serviceKonto: z.object({
          type: z.string().default(''),
          trustLevel: z.string().default(''),
          postfachAddress: z.object({
            identifier: z.string().default(''),
            type: z.string().default(''),
          }),
        }),
      })
      .optional(),
  }),
  mistral: z
    .object({
      apiKey: z.string(),
    })
    .optional(),
  bntk: z
    .object({
      private_jwk: z.object({
        crv: z.string(),
        d: z.string(),
        key_ops: z.array(z.string()),
        kty: z.string(),
        x: z.string(),
        y: z.string(),
        alg: z.string(),
        use: z.string(),
        kid: z.string(),
      }),
      domain: z.string(),
    })
    .optional(),
  rateLimit: z
    .object({
      upload: z
        .object({
          enabled: z.boolean().default(true),
          max: z.number().int().positive().default(5),
          windowMs: z.number().int().positive().default(30000),
        })
        .default({}),
      chatbot: z
        .object({
          enabled: z.boolean().default(true),
          max: z.number().int().positive().default(5),
          windowMs: z.number().int().positive().default(30000),
        })
        .default({}),
    })
    .default({}),
});

export type ServerConfig = z.infer<typeof ConfigSchema>;

export async function loadServerConfiguration(env: CONFIG_TYPE) {
  const config = await ConfigLoader.loadServerConfiguration(
    __dirname,
    env,
    ConfigSchema
  );

  return {
    ...config,
    configType: CONFIG_TYPE_SCHEMA.parse(env),
  };
}
