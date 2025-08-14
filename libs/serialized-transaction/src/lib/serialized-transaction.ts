import { sleep } from '@startuphafen/utility';
import { Knex } from 'knex';

const SERIALIZATION_ERROR_CODE = 40001; // thats Postgres error code for an serialization error

export type TransactionWork<T> = (trx: Knex.Transaction) => Promise<T>;
export type TransactionFactory = <T>(
  work: TransactionWork<T>,
  readOnly?: boolean
) => Promise<T>;

//#region [Color1] transaction
/**
 * A factory function which returns a function with transaction in a serializable isolation level.
 * Be warned that this function will repeat itself n-times. Therefore **don't** put any logic with any **side effects** in the transaction.
 *
 * This effort is done to prevent any unwanted database changes or reads, which can cause serious issues as you can see [here](https://news.ycombinator.com/item?id=7353095).
 *
 * @see [Postgres Transaction Isolation ](https://www.postgresql.org/docs/current/transaction-iso.html)
 * @see [Knex Transaction Modes](https://knexjs.org/guide/transactions.html#transaction-modes)
 * @see [Serializable Isolation with Postgres](https://hiddentao.com/archives/2019/07/29/how-to-use-serializable-isolation-with-postgres-transactions)
 * @see [Isolation (database systems)](https://en.wikipedia.org/wiki/Isolation_(database_systems))
 * @param knx The knex context.
 * @param retries The amount of retries which will be made by the transaction. The default is 5.
 * @returns A Promise which has been returned inside the transaction.
 */
export function createRepeatedSerializedKnexTransaction(
  knex: Knex,
  retries = 5
): TransactionFactory {
  return async <E>(
    sideEffectFreeTransactionHandler: TransactionWork<E>,
    readOnly?: boolean
  ) => {
    const retriesObj = { retries: 0 };
    const tryTransaction: () => Promise<E> = async () => {
      try {
        return await knex.transaction(
          async (trx) => {
            return await sideEffectFreeTransactionHandler(trx);
          },
          { isolationLevel: 'serializable', readOnly }
        );
      } catch (err: any) {
        return await handleError(err, retriesObj, retries, tryTransaction);
      }
    };

    return await tryTransaction();
  };
}
//#endregion

//#region [Color3] error
async function handleError<E>(
  err: unknown, // sadly knex hasn't any proper interfaces for an pg error
  retriesObj: { retries: number },
  transactionRetries: number,
  tryTransaction: () => Promise<E>
): Promise<E> {
  if (checkError(err, retriesObj.retries, transactionRetries)) {
    retriesObj.retries++;
    await createDelay(retriesObj.retries);
    return await tryTransaction();
  } else {
    throw err;
  }
}

export async function createDelay(retries: number) {
  const maxTime = Math.min(10, retries); // abs max will be 1024ms +-
  const minTime = Math.min(10 - 1, retries); // abs min will be 512ms +-
  const delay = randomNumFromInterval(
    Math.pow(2, minTime),
    Math.pow(2, maxTime)
  );
  await sleep(delay);
  return delay; // only for test
}

const randomNumFromInterval = (min: number, max: number) =>
  Math.random() * (max - min + 1) + min;

export function checkError(
  err: unknown,
  retries: number,
  _transactionRetries: number
) {
  return (
    err !== null &&
    typeof err === 'object' &&
    (err as any).code == SERIALIZATION_ERROR_CODE &&
    retries < _transactionRetries
  );
}
//#endregion
