import {
  IdentificationDocument,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

export class IdentificationDocumentsDbController {
  constructor(private trx: Knex.Transaction) {}

  private table = STARTUPHAFENBACKEND_TABLES.IDENTIFICATIONDOCUMENT;

  async upsertByTaxId(
    userId: string,
    input: {
      file: Uint8Array;
      mimeType: string;
      fileName: string;
      taxId: string;
      projectId: number;
    }
  ) {
    const existing = await this.trx<IdentificationDocument>(this.table)
      .where({ taxId: input.taxId, userId: userId, projectId: input.projectId })
      .first();

    if (existing) {
      await this.trx<IdentificationDocument>(this.table)
        .update({
          mimeType: input.mimeType,
          fileName: input.fileName,
          data: input.file,
          createdAt: new Date(),
        })
        .where({
          userId: userId,
          taxId: input.taxId,
          projectId: input.projectId,
        });
    } else {
      await this.trx<IdentificationDocument>(this.table).insert({
        userId,
        mimeType: input.mimeType,
        fileName: input.fileName,
        data: input.file,
        taxId: input.taxId,
        projectId: input.projectId,
      });
    }
  }

  async getData(
    userId: string,
    taxId: string,
    projectId: number
  ): Promise<{ data: Uint8Array; mimeType: string; fileName: string } | null> {
    const query = this.trx<IdentificationDocument>(this.table)
      .select('data', 'mimeType', 'fileName')
      .where({ userId: userId, taxId: taxId, projectId: projectId });
    const result = await query;
    if (result.length === 0) return null;
    return result[0];
  }

  async deleteForProject(projectId: number) {
    await this.trx<IdentificationDocument>(this.table)
      .where({ projectId: projectId })
      .delete();
  }

  async getByProject(projectId: number) {
    return await this.trx<IdentificationDocument>(this.table)
      .where({ projectId: projectId })
      .select('taxId', 'mimeType', 'createdAt', 'data');
  }

  async deleteDocumentsWithoutProject(): Promise<number> {
    return await this.trx<IdentificationDocument>(this.table)
      .whereNull('projectId')
      .delete();
  }

  async deleteDocumentsWithoutProjectForUser(userId: string) {
    await this.trx<IdentificationDocument>(this.table)
      .where({ userId: userId })
      .whereNull('projectId')
      .delete();
  }
}
