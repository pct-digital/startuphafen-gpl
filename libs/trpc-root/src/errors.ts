import { TRPCError } from '@trpc/server';

export function logServerSideError(
  err: TRPCError,
  type: string,
  path: string | undefined,
  input: unknown,
  _ctx: unknown
) {
  console.log(
    `tRPC API ERROR ${type} ${path}:\n${err.name} Code ${err.code}\n${
      err.message
    }\n${err.stack}\nINPUT:\n${JSON.stringify(
      input,
      undefined,
      2
    )}\nCAUSE:\n${JSON.stringify(
      err.cause,
      Object.getOwnPropertyNames(err),
      2
    )}\n`
  );
}
