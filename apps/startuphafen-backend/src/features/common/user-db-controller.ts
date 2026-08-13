import {
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

/**
 * Db controller for user lookups. New database access code should be
 * organized in db controllers like this one.
 */
export class UserDbController {
  constructor(private trx: Knex.Transaction) {}

  async getUserById(id: string) {
    // make sure to use the type on trx, like <ShUser> and make sure to use the table constant!
    return this.trx<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .where({
        id,
      })
      .first();
  }

  async getUserCount() {
    const res = await this.trx(STARTUPHAFENBACKEND_TABLES.SHUSER).count<
      { count: string }[]
    >('* as count');
    return Number(res[0].count ?? 0);
  }

  async getUserCreatedRatio() {
    const result = await this.trx(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .select(
        this.trx.raw(
          `TO_CHAR("createdAt", 'DD.MM.YYYY') as "createdAtFormatted"`
        ),
        this.trx.raw(`MIN("createdAt") as "earliestCreatedAt"`)
      )
      .count('* as amount')
      .groupBy('createdAtFormatted')
      .orderBy('earliestCreatedAt');

    return result.map((u) => ({
      createdAt: u['createdAtFormatted'].toString(),
      amount: Number(u['amount']),
    }));
  }
}
