import {
  OzgInfo,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';
import { GemeindeEntry } from './plz-lookup-service';

const OZG_INFO_TABLE = STARTUPHAFENBACKEND_TABLES.OZGINFO;

export type OzgInfoInput = Omit<OzgInfo, 'id' | 'createdAt'>;
export type UniqueAmtRow = Pick<OzgInfo, 'amt' | 'amtCode' | 'domain'>;

export class OzgInfoDbController {
  constructor(private trx: Knex.Transaction) {}

  async replaceForProject(
    projectId: number,
    plz: string,
    entries: GemeindeEntry[]
  ): Promise<number> {
    await this.trx(OZG_INFO_TABLE).where({ projectId }).delete();

    const validEntries = entries.filter(
      (entry) =>
        typeof entry.domain === 'string' &&
        entry.domain.trim().length > 0 &&
        entry.oeid !== undefined
    );

    if (validEntries.length > 0) {
      const records = validEntries.map((entry) => ({
        projectId,
        plz,
        kreis: entry.kreis,
        gemeinde: entry.gemeinde,
        amt: entry.amt,
        amtCode: entry.amtCode,
        domain: entry.domain!.trim(),
        oeid: entry.oeid,
      }));

      await this.trx(OZG_INFO_TABLE).insert(records);
      return records.length;
    }

    return 0;
  }

  async getByProjectId(projectId: number): Promise<OzgInfo[]> {
    return this.trx<OzgInfo>(OZG_INFO_TABLE).where({ projectId });
  }

  async getUniqueAmtsByProjectId(projectId: number): Promise<UniqueAmtRow[]> {
    return this.trx<OzgInfo>(OZG_INFO_TABLE)
      .distinct('amt', 'amtCode', 'domain')
      .where({ projectId })
      .orderBy('amt', 'asc')
      .orderBy('amtCode', 'asc')
      .orderBy('domain', 'asc');
  }
}
