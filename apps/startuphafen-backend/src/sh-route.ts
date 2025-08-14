import { authMiddleware, baseProcedure } from '@startuphafen/trpc-root';

export const shRoute = baseProcedure.use(authMiddleware);
