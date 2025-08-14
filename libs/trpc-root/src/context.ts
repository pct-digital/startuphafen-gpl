import { TransactionFactory } from '@startuphafen/serialized-transaction';
import { ShUser } from '@startuphafen/startuphafen-common';
import { KeycloakToken } from './openid';

export type StandardRequestContext = {
  trxFactory: TransactionFactory;
  token?: KeycloakToken;
  user?: ShUser;
  featureFlags?: Record<string, boolean>;
};

export const RouteAnon = 'anon';
export const RouteLogin = 'login';

export interface Meta {
  /**
   * The roles the given tRPC route needs to allow you to call it.
   * Any one of these roles is enough, you don't need all of them!
   *
   * Special roles: RouteAnon (anon) & RouteLogin (login)
   * Anon means even without a login.
   * Login means any role is fine, as long as the user is logged in.
   */
  requiredRolesAny: string[];

  /**
   * none/undefined does not log
   * content logs all input and output data
   * audit only logs what was called by whom, but no input/output data
   */
  logCalls?: 'none' | 'content' | 'audit';
}
