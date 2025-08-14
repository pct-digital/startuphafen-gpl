import { DBMigrationSchema } from '@startuphafen/db-migration';
import { KeycloakAccessConfigSchema } from '@startuphafen/trpc-root';
import {
  CONFIG_TYPE,
  ConfigLoader,
  FileAccess,
} from '@startuphafen/utility-server';
import { WatermarkSchema } from '@startuphafen/watermark/server';
import path from 'path';
import { z } from 'zod';

export const ConfigSchema = z.object({
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
    noSSL: z.boolean().optional(),
  }),
  allowedOrigins: z.array(z.string()),
  keycloak: KeycloakAccessConfigSchema,
  watermarkConfig: WatermarkSchema,
  dbMigration: DBMigrationSchema,
  eric: z.object({
    devMode: z.boolean().default(true),
  }),
});

export const LocalSecretsSchema = z.object({
  strapi: z.object({
    host: z.string(),
    token: z.string(),
  }),
  eric: z.object({
    host: z.string(),
    token: z.string(),
    finanzAmtId: z.string(),
  }),
  ozg: z.object({
    host: z.string(),
    control: z.object({
      zustaendigeStelle: z.string(),
      leikaIds: z.array(z.string()),
      formId: z.string(),
      name: z.string(),
      serviceKonto: z.object({
        type: z.string(),
        trustLevel: z.string(),
        postfachAddress: z.object({
          identifier: z.string(),
          type: z.string(),
        }),
      }),
    }),
  }),
});

export type ServerConfig = z.infer<typeof ConfigSchema>;
export type LocalSecrets = z.infer<typeof LocalSecretsSchema>;

export async function loadServerConfiguration(env: CONFIG_TYPE) {
  return await ConfigLoader.loadServerConfiguration(
    __dirname,
    env,
    ConfigSchema
  );
}

export async function loadLocalSecrets(e2e: boolean) {
  try {
    const faccess = new FileAccess();
    let fileContent;

    if (e2e) {
      const dummy: LocalSecrets = {
        strapi: { host: '', token: '' },
        eric: { host: '', token: '', finanzAmtId: '' },
        ozg: {
          host: '',
          control: {
            zustaendigeStelle: '',
            leikaIds: [],
            formId: '',
            name: '',
            serviceKonto: {
              type: '',
              trustLevel: '',
              postfachAddress: {
                identifier: '',
                type: '',
              },
            },
          },
        },
      };
      fileContent = JSON.stringify(dummy);
    } else {
      fileContent = await faccess.readTextFile(
        path.join(__dirname, 'assets', 'config-secrets.json')
      );
    }

    return JSON.parse(fileContent);
  } catch (e: any) {
    console.log(
      '### WARNING: NO local config file was found. Please consult the README.'
    );
    return {
      strapi: { host: '', token: '' },
      eric: { host: '', token: '', finanzAmtId: '' },
      ozg: {
        host: '',
        control: {
          zustaendigeStelle: '',
          leikaIds: [],
          formId: '',
          name: '',
          serviceKonto: {
            type: '',
            trustLevel: '',
            postfachAddress: {
              identifier: '',
              type: '',
            },
          },
        },
      },
    } as LocalSecrets;
  }
}
