import { Knex } from 'knex';
import { TransactionFactory, checkError, createDelay, createRepeatedSerializedKnexTransaction } from './serialized-transaction';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { DockerizedPostgres } from '../../../dockerized-node-libs/src';

const postgres = new DockerizedPostgres();

jest.setTimeout(600000);

interface Accounts {
  id: number;
  balance: number;
}

const dummyData: Accounts[] = [
  { id: 1, balance: 100 },
  { id: 2, balance: 200 },
  { id: 3, balance: 300 },
  { id: 4, balance: 400 },
];

async function setupDb(transaction: <E>(cb: (trx: Knex.Transaction<any, any[]>) => Promise<E>) => Promise<E>) {
  return await transaction(async (trx) => {
    await trx.schema.createTable('accounts', (table) => {
      table.integer('id');
      table.integer('balance');
    });

    await trx<Accounts>('accounts').insert(dummyData);

    return trx<Accounts>('accounts').select();
  });
}

function makeBlocker() {
  let resolver = () => {};
  const p = new Promise<void>((resolve) => (resolver = resolve));
  return {
    promise: p,
    resolver,
  };
}

const randomIntFromInterval = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

describe('serialized transaction', () => {
  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('expect transaction to work', async () => {
    const transaction = createRepeatedSerializedKnexTransaction(postgres.knex, 3);
    const returnData = await setupDb(transaction);

    expect(returnData).toEqual(dummyData);
  });

  it('does not allow dirty reads', async () => {
    const transaction = createRepeatedSerializedKnexTransaction(postgres.knex, 3);
    const successful = await setupDb(transaction);
    expect(successful).toEqual(dummyData);

    const step1 = makeBlocker();
    const step2 = makeBlocker();

    const x1 = transaction(async (trx1) => {
      await trx1<Accounts>('accounts').where({ id: 1 }).update({ balance: 50 });
      step2.resolver();
      await step1.promise;
    });
    const x2 = transaction(async (_trx2) => {
      await step2.promise;
      const result = await _trx2<Accounts>('accounts').select().where({ id: 1 }).first();
      step1.resolver();
      return result;
    });
    const [_, result2] = await Promise.all([x1, x2]);

    expect(result2).toEqual({ id: 1, balance: 100 });
    // it has been changes in the first uncommitted transaction before the second transaction had the chance to read it,
    // but the values stayed the same as it was at the beginning
  });

  it('could not serialize access due to concurrent update', async () => {
    const transaction = createRepeatedSerializedKnexTransaction(postgres.knex, 0);
    const successful = await setupDb(transaction);
    expect(successful).toEqual(dummyData);

    const step1 = makeBlocker();
    const step2 = makeBlocker();

    const x1 = transaction(async (trx1) => {
      await trx1<Accounts>('accounts').where({ id: 1 }).update({ id: 1, balance: 200 });
      const result = await trx1<Accounts>('accounts').where({ id: 1 }).first();
      step2.resolver();
      await step1.promise;
      return result;
    });
    const x2 = transaction(async (trx2) => {
      await step2.promise;
      const u1 = trx2<Accounts>('accounts').where({ id: 1 }).update({ id: 1, balance: 0 });
      // instant start the query
      let e = null;
      const u2Blocker = makeBlocker();
      u1.then(() => u2Blocker.resolver()).catch((x) => {
        e = x;
        u2Blocker.resolver();
      });
      // only after the query is started allow the other transaction to close
      step1.resolver();
      await u2Blocker.promise;
      throw e;
    });

    await expect(x1).resolves.toEqual({ balance: 200, id: 1 });
    await expect(x2).rejects.toThrow('could not serialize access due to concurrent update');
  });

  it('could not serialize access due to read/write dependencies among transactions', async () => {
    const transaction = createRepeatedSerializedKnexTransaction(postgres.knex, 0);
    const successful = await setupDb(transaction);
    expect(successful).toEqual(dummyData);

    const step1 = makeBlocker();
    const step2 = makeBlocker();

    const x1 = transaction(async (trx1) => {
      const result = await trx1<Accounts>('accounts').sum('balance').whereIn('id', [1, 2]).first();
      await trx1<Accounts>('accounts').update('balance', Number(result!['sum'])).whereIn('id', [3, 4]);
      step2.resolver();
      await step1.promise;
    });
    const x2 = transaction(async (trx2) => {
      const result = await trx2<Accounts>('accounts').sum('balance').whereIn('id', [3, 4]).first();
      await trx2<Accounts>('accounts').update('balance', Number(result!['sum'])).whereIn('id', [1, 2]);
      step1.resolver();
      await step2.promise;
    });

    await expect(Promise.all([x1, x2])).rejects.toThrow('could not serialize access due to read/write dependencies among transactions');
  });

  it('check for uncommitted transaction', async () => {
    const transaction = createRepeatedSerializedKnexTransaction(postgres.knex, 0);
    const successful = await setupDb(transaction);
    expect(successful).toEqual(dummyData);

    await transaction(async (trx) => {
      await trx<Accounts>('accounts')
        .where({ id: 1 })
        .update({ balance: randomIntFromInterval(1, 1000) });
    });

    expect((postgres.knex.client as any).pool.numUsed()).toBe(0);
  });

  it('should not retry on no serialization error', async () => {
    const transaction = createRepeatedSerializedKnexTransaction(postgres.knex, 10);
    const successful = await setupDb(transaction);
    expect(successful).toEqual(dummyData);

    const faultyData = 'Faulty Data';
    const toThrow = transaction(async (trx) => {
      await trx('accounts').insert({ id: 1, balance: faultyData });
    });

    await expect(toThrow).rejects.toThrow(`invalid input syntax for type integer: "${faultyData}"`);
  });

  it('time delay should be random', async () => {
    const delayedTime1: number[] = [];
    for (let i = 1; i < 10; i++) delayedTime1.push(await createDelay(i));

    const delayedTime2: number[] = [];
    for (let i = 1; i < 10; i++) delayedTime2.push(await createDelay(i));

    expect(delayedTime1).not.toEqual(delayedTime2);
    expect(delayedTime1.every((num) => num <= 1100)).toBe(true);
    expect(delayedTime2.every((num) => num <= 1100)).toBe(true);
  });

  it('should handle massive load', async () => {
    const transaction = createRepeatedSerializedKnexTransaction(postgres.knex, 100);
    const successful = await setupDb(transaction);
    expect(successful).toEqual(dummyData);

    const promises: Promise<void>[] = [];

    for (let i = 0; i < 1000; i++) {
      promises.push(
        transaction(async (trx) => {
          await trx<Accounts>('accounts')
            .where({ id: 1 })
            .update({ balance: randomIntFromInterval(1, 1000) });
        })
      );
    }

    await expect(Promise.all(promises)).resolves.not.toThrow();
  });

  it('error checking should work', async () => {
    const validErrorInt = {
      code: 40001,
    };
    expect(checkError(validErrorInt, 0, 1)).toBe(true);

    expect(checkError(validErrorInt, 1, 1)).toBe(false);

    const validErrorString = {
      code: '40001',
    };
    expect(checkError(validErrorString, 0, 1)).toBe(true);

    const invalidCode = {
      code: 42,
    };
    expect(checkError(invalidCode, 0, 1)).toBe(false);

    const invalidObject = {
      some: '42',
    };
    expect(checkError(invalidObject, 0, 1)).toBe(false);

    expect(checkError(null, 0, 1)).toBe(false);

    expect(checkError(undefined, 0, 1)).toBe(false);
  });

  const createATestTable = async (trx: TransactionFactory) => {
    await trx(async (trx) => {
      await trx.schema.createTable('test', (table) => {
        table.integer('id');
        table.integer('balance');
      });
    });
  };

  const tryToInsert = async (trx: TransactionFactory, readOnly: boolean) => {
    return await trx(async (trx) => {
      return await trx('test').insert({ id: 1, balance: 12 }).returning('*');
    }, readOnly);
  };
  it('Should throw an error if trying to update in readonly transaciton', async () => {
    const trx = createRepeatedSerializedKnexTransaction(postgres.knex, 2);
    await createATestTable(trx);
    try {
      await tryToInsert(trx, true);
    } catch (error) {
      expect((error as Error).message).toContain('cannot execute INSERT in a read-only transaction');
    }
    const r = await tryToInsert(trx, false);
    expect(r.length).toBe(1);
  });
});
