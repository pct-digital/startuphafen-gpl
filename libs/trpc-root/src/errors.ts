import { TRPCError } from '@trpc/server';

const REDACTED = '[redacted]';

const SENSITIVE_KEY_RE =
  /passphrase|password|secret|credential|api[_-]?key|private[_-]?key|token/i;

export function redactSecrets(key: string, value: unknown) {
  if (key && SENSITIVE_KEY_RE.test(key)) {
    return REDACTED;
  }
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return `[binary ${value.byteLength} bytes]`;
  }
  return value;
}

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
      redactSecrets,
      2
    )}\nCAUSE:\n${JSON.stringify(
      err.cause,
      Object.getOwnPropertyNames(err),
      2
    )}\n`
  );
}
