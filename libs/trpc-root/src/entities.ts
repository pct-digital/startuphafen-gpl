import type {
  AnyMutationProcedure,
  AnyProcedure,
  AnyQueryProcedure,
  AnyRouter,
  ProcedureRouterRecord,
  inferProcedureInput,
  inferProcedureOutput,
} from '@trpc/server';

export type DecorateProcedure<TProcedure extends AnyProcedure> =
  TProcedure extends AnyQueryProcedure
    ? {
        query: Resolver<TProcedure>;
      }
    : TProcedure extends AnyMutationProcedure
    ? {
        mutate: Resolver<TProcedure>;
      }
    : never;

type Resolver<TProcedure extends AnyProcedure> = (
  input: inferProcedureInput<TProcedure>
) => Promise<inferProcedureOutput<TProcedure>>;

export type DecoratedProcedureRecord<
  TProcedures extends ProcedureRouterRecord
> = {
  [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyRouter
    ? DecoratedProcedureRecord<TProcedures[TKey]['_def']['record']>
    : TProcedures[TKey] extends AnyProcedure
    ? DecorateProcedure<TProcedures[TKey]>
    : never;
};

export interface BundIDAddress {
  street?: string;
  streetNumber?: string;
  addressLine?: string;
  locality: string;
  postalCode: string;
  country: string;
  streetAddress: string;
}
