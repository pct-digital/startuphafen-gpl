import { readFile } from 'fs/promises';
import { z } from 'zod';
import { getAssetPath } from '../../assets-loader';

export interface GemeindeEntry {
  kreis: string;
  gemeinde: string;
  amt: string;
  amtCode: string;
  domain: string | null;
  oeid?: string;
}

export type PlzMapping = Record<string, GemeindeEntry[]>;

let cachedMapping: PlzMapping | null = null;
const KOP_DOMAIN_SEGMENT = '.kop.';
const KOP_STAGING_DOMAIN_SEGMENT = '.kop-stage.';

const gemeindeEntrySchema = z.object({
  kreis: z.string(),
  gemeinde: z.string(),
  amt: z.string(),
  amtCode: z.string(),
  domain: z.string().nullable(),
  oeid: z.string().optional(),
});

const plzMappingSchema = z.record(z.array(gemeindeEntrySchema));

export function resolveOzgDomain(
  domain: string | null,
  useStagingDomain: boolean
) {
  if (domain == null || !useStagingDomain) {
    return domain;
  }

  return domain.replace(KOP_DOMAIN_SEGMENT, KOP_STAGING_DOMAIN_SEGMENT);
}

export class PlzLookupService {
  constructor(
    private readonly options: {
      useStagingDomain?: boolean;
    } = {}
  ) {}

  private async loadMapping(): Promise<PlzMapping> {
    if (cachedMapping) {
      return cachedMapping;
    }

    const assetPath = getAssetPath('plz-mapping/plz-mapping.json');
    const data = await readFile(assetPath, 'utf8');
    const parsedMapping = plzMappingSchema.parse(JSON.parse(data));
    cachedMapping = parsedMapping;
    return parsedMapping;
  }

  async lookup(plz: string) {
    const mapping = await this.loadMapping();
    return (mapping[plz] ?? []).map((entry) => ({
      ...entry,
      domain: resolveOzgDomain(
        entry.domain,
        this.options.useStagingDomain ?? false
      ),
    }));
  }
}
