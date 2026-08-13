import {
  Answers,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

export interface AnswerUpsertInput {
  key: string;
  projectId: number;
  stringValue: string | null;
  componentId: string;
  value: string;
  type: string;
  xmlKey: string;
  questionText: string;
  answerText: string;
  headerText: string | null;
}

export class AnswerDbController {
  constructor(private trx: Knex.Transaction) {}

  /**
   * Batch upsert answers within a transaction
   * Fetches existing answers, then performs updates and inserts accordingly
   *
   * @param answers Array of answers to upsert
   * @returns Record mapping answer keys to their database IDs
   */
  async upsertBatch(
    answers: AnswerUpsertInput[],
    projectId: number
  ): Promise<Record<string, number>> {
    if (answers.length === 0) {
      return {};
    }

    for (const answer of answers) {
      if (answer.projectId !== projectId) {
        throw new Error('ProjectIds not identical!');
      }
    }

    const keys = answers.map((a) => a.key);

    // Fetch existing answers for this project and these keys
    const existing = await this.trx<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .where({ projectId })
      .whereIn('key', keys)
      .select('id', 'key');

    const existingByKey = new Map<string, number>();
    for (const row of existing) {
      existingByKey.set(row.key, row.id);
    }

    const keyToIdMap: Record<string, number> = {};
    const toInsert: AnswerUpsertInput[] = [];
    const toUpdate: Array<{ id: number; data: Partial<AnswerUpsertInput> }> =
      [];

    // Separate answers into updates and inserts
    for (const answer of answers) {
      const existingId = existingByKey.get(answer.key);
      if (existingId) {
        toUpdate.push({
          id: existingId,
          data: {
            value: answer.value,
            xmlKey: answer.xmlKey,
            stringValue: answer.stringValue,
            componentId: answer.componentId,
            type: answer.type,
            questionText: answer.questionText,
            answerText: answer.answerText,
            headerText: answer.headerText,
          },
        });
        keyToIdMap[answer.key] = existingId;
      } else {
        toInsert.push(answer);
      }
    }

    // Perform updates
    for (const { id, data } of toUpdate) {
      await this.trx<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
        .where({ id })
        .update(data);
    }

    // Perform inserts
    if (toInsert.length > 0) {
      const inserted = await this.trx<Answers>(
        STARTUPHAFENBACKEND_TABLES.ANSWERS
      )
        .insert(toInsert)
        .returning(['id', 'key']);

      for (const row of inserted) {
        keyToIdMap[row.key] = row.id;
      }
    }

    return keyToIdMap;
  }

  /**
   * Batch delete answers by keys and projectId
   * Deletes all answers matching the given keys for the specified project
   * Does nothing if the keys don't exist
   *
   * @param keys Array of answer keys to delete
   * @param projectId Project ID to delete answers from
   */
  async batchDelete(keys: string[], projectId: number): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.trx<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS)
      .where({ projectId })
      .whereIn('key', keys)
      .delete();
  }
}
