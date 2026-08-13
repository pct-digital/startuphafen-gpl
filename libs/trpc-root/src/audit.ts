import { StandardRequestContext } from './context';

export function resolveAuditActor(ctx: StandardRequestContext): string | null {
  const fullName = [ctx.user?.firstName, ctx.user?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');

  return (
    ctx.user?.name?.trim() ||
    fullName ||
    ctx.token?.preferred_username ||
    ctx.token?.sub ||
    null
  );
}
