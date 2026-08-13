import {
  HwkMailLog,
  HwkMailStatus,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

type HwkMailLogStatus = Exclude<HwkMailStatus['status'], 'not_applicable'>;

export type HwkMailLogRow = Omit<HwkMailLog, 'status'> & {
  status: HwkMailLogStatus;
};

type HwkMailLogInsert = Omit<HwkMailLogRow, 'id'>;

export class HwkMailDbController {
  constructor(private trx: Knex.Transaction) {}

  async getByProjectId(projectId: number) {
    return this.trx<HwkMailLogRow>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .where({ projectId })
      .first();
  }

  async getById(id: number) {
    return this.trx<HwkMailLogRow>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .where({ id })
      .first();
  }

  async updateById(id: number, updates: Partial<HwkMailLogInsert>) {
    const rows = await this.trx<HwkMailLogRow>(
      STARTUPHAFENBACKEND_TABLES.HWKMAILLOG
    )
      .where({ id })
      .update(updates, '*');
    return rows[0] as HwkMailLogRow | undefined;
  }

  async insert(data: HwkMailLogInsert) {
    const rows = await this.trx<HwkMailLogRow>(
      STARTUPHAFENBACKEND_TABLES.HWKMAILLOG
    ).insert(data, '*');
    return rows[0];
  }

  async upsertPendingByProjectId(input: {
    projectId: number;
    userId: string;
    recipient: string;
    cc: string | null;
    replyTo: string | null;
    subject: string;
    now: Date;
  }) {
    const rows = await this.trx<HwkMailLogRow>(
      STARTUPHAFENBACKEND_TABLES.HWKMAILLOG
    )
      .insert(
        {
          projectId: input.projectId,
          userId: input.userId,
          status: 'pending',
          recipient: input.recipient,
          cc: input.cc,
          replyTo: input.replyTo,
          subject: input.subject,
          mailBody: null,
          mailFrom: null,
          mailContentType: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          nextAttemptAt: input.now,
          sentAt: null,
          createdAt: input.now,
          updatedAt: input.now,
        },
        '*'
      )
      .onConflict('projectId')
      .merge({
        status: 'pending',
        recipient: input.recipient,
        cc: input.cc,
        replyTo: input.replyTo,
        subject: input.subject,
        lastError: null,
        nextAttemptAt: input.now,
        updatedAt: input.now,
      });
    return rows[0];
  }

  async findDueLogs(now: Date, staleBefore: Date, batchSize: number) {
    return this.trx<HwkMailLogRow>(STARTUPHAFENBACKEND_TABLES.HWKMAILLOG)
      .where((qb) => {
        qb.where((inner) => {
          inner
            .whereIn('status', ['pending', 'failed'])
            .whereNotNull('nextAttemptAt')
            .andWhere('nextAttemptAt', '<=', now);
        }).orWhere((inner) => {
          inner
            .where('status', 'sending')
            .andWhere('updatedAt', '<=', staleBefore);
        });
      })
      .orderBy('nextAttemptAt', 'asc')
      .limit(batchSize);
  }

  async claimForSending(logId: number, now: Date, staleBefore: Date) {
    const rows = await this.trx<HwkMailLogRow>(
      STARTUPHAFENBACKEND_TABLES.HWKMAILLOG
    )
      .where({ id: logId })
      .andWhere((qb) => {
        qb.where((inner) => {
          inner
            .whereIn('status', ['pending', 'failed'])
            .where('nextAttemptAt', '<=', now);
        }).orWhere((inner) => {
          inner
            .where('status', 'sending')
            .andWhere('updatedAt', '<=', staleBefore);
        });
      })
      .update(
        {
          status: 'sending',
          updatedAt: now,
        },
        '*'
      );
    return rows[0] as HwkMailLogRow | undefined;
  }
}
