import {
  HWK_DOCUMENT_CASES,
  HwkDocumentCase,
  STARTUPHAFENBACKEND_TABLES,
  UserDocument,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

export class UserDocumentDbController {
  constructor(private trx: Knex.Transaction) {}

  private table = STARTUPHAFENBACKEND_TABLES.USERDOCUMENT;

  async upload(
    userId: string,
    input: {
      file: Uint8Array;
      filename: string;
      mimeType: string;
      projectId: number;
      documentCase?: HwkDocumentCase;
    }
  ) {
    const result = await this.trx<UserDocument>(this.table)
      .insert({
        userId,
        filename: input.filename,
        mimeType: input.mimeType,
        data: input.file,
        projectId: input.projectId,
        documentCase: input.documentCase ?? null,
      })
      .returning([
        'id',
        'filename',
        'mimeType',
        'createdAt',
        'projectId',
        'documentCase',
      ]);
    return result[0];
  }

  async updateContent(documentId: number, file: Uint8Array) {
    await this.trx<UserDocument>(this.table).where({ id: documentId }).update({
      data: file,
    });
  }

  async list(userId: string) {
    const result = await this.trx<UserDocument>(this.table)
      .select(
        'id',
        'filename',
        'mimeType',
        'createdAt',
        'projectId',
        'documentCase'
      )
      .where({ userId: userId });
    return result;
  }

  async getData(userId: string, docId: number, projectId?: number) {
    const query = this.trx<UserDocument>(this.table)
      .select('id', 'data')
      .where({ userId: userId, id: docId });

    if (projectId != null) {
      query.andWhere({ projectId: projectId });
    }

    const result = await query;
    if (result.length === 0) return null;
    return result[0];
  }

  async listByProject(userId: string, projectId: number) {
    const result = await this.trx<UserDocument>(this.table)
      .select(
        'id',
        'filename',
        'mimeType',
        'createdAt',
        'projectId',
        'documentCase'
      )
      .where({
        userId: userId,
        projectId: projectId,
      })
      .orderBy('createdAt', 'asc');
    return result;
  }

  async listByProjectAndCase(
    userId: string,
    projectId: number,
    documentCase: HwkDocumentCase
  ) {
    const result = await this.trx<UserDocument>(this.table)
      .select(
        'id',
        'filename',
        'mimeType',
        'createdAt',
        'projectId',
        'documentCase'
      )
      .where({
        userId: userId,
        projectId: projectId,
        documentCase: documentCase,
      })
      .orderBy('createdAt', 'asc');
    return result;
  }

  async getCaseStats(
    userId: string,
    projectId: number,
    documentCase: HwkDocumentCase,
    skipDocumentId?: number
  ) {
    let rows = await this.trx<UserDocument>(this.table)
      .select('data', 'id')
      .where({
        userId: userId,
        projectId: projectId,
        documentCase: documentCase,
      });

    if (skipDocumentId !== undefined) {
      rows = rows.filter((row) => row.id !== skipDocumentId);
    }

    const totalBytes = rows.reduce((sum, row) => sum + row.data.byteLength, 0);
    return {
      count: rows.length,
      totalBytes,
    };
  }

  async listHwkMailAttachments(userId: string, projectId: number) {
    const result = await this.trx<UserDocument>(this.table)
      .select(
        'id',
        'userId',
        'filename',
        'mimeType',
        'documentCase',
        'data',
        'createdAt',
        'projectId'
      )
      .where({
        userId: userId,
        projectId: projectId,
      })
      .whereIn('documentCase', HWK_DOCUMENT_CASES)
      .orderBy('createdAt', 'asc');

    return result;
  }

  async delete(docId: number, userId: string) {
    const result = await this.trx<UserDocument>(this.table)
      .where({ id: docId, userId: userId })
      .delete(['id']);
    if (result[0] == null) return;
    return result[0].id;
  }
}
