import { sleep } from '@startuphafen/utility';
import { IncomingMessage } from 'http';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { z } from 'zod';

/**
 * @see https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
 */
export interface OidcClaims {
  /** Subject - Identifier for the End-User at the Issuer. */
  sub: string;
  /** End-User's full name in displayable form including all name parts, possibly including titles and suffixes, ordered according to the End-User's locale and preferences. */
  name?: string;
  /** 	Given name(s) or first name(s) of the End-User. Note that in some cultures, people can have multiple given names; all can be present, with the names being separated by space characters. */
  given_name?: string;
  /** Surname(s) or last name(s) of the End-User. Note that in some cultures, people can have multiple family names or no family name; all can be present, with the names being separated by space characters. */
  family_name?: string;
  /** Middle name(s) of the End-User. Note that in some cultures, people can have multiple middle names; all can be present, with the names being separated by space characters. Also note that in some cultures, middle names are not used. */
  middle_name?: string;
  /** Casual name of the End-User that may or may not be the same as the given_name. For instance, a nickname value of Mike might be returned alongside a given_name value of Michael. */
  nickname?: string;
  /** Shorthand name by which the End-User wishes to be referred to at the RP, such as janedoe or j.doe. This value MAY be any valid JSON string including special characters such as @, /, or whitespace. The RP MUST NOT rely upon this value being unique, as discussed in Section 5.7. */
  preferred_username?: string;
  /** URL of the End-User's profile page. The contents of this Web page SHOULD be about the End-User. */
  profile?: string;
  /** URL of the End-User's profile picture. This URL MUST refer to an image file (for example, a PNG, JPEG, or GIF image file), rather than to a Web page containing an image. Note that this URL SHOULD specifically reference a profile photo of the End-User suitable for displaying when describing the End-User, rather than an arbitrary photo taken by the End-User.. */
  picture?: string;
  /** URL of the End-User's Web page or blog. This Web page SHOULD contain information published by the End-User or an org */
  website?: string;
  /** End-User's preferred e-mail address. Its value MUST conform to the RFC 5322 [RFC5322] addr-spec syntax. The RP MUST NOT rely upon this value being unique, as discussed in Section 5.7. */
  email?: string;
  /** True if the End-User's e-mail address has been verified; otherwise false. When this Claim Value is true, this means that the OP took affirmative steps to ensure that this e-mail address was controlled by the End-User at the time the verification was performed. The means by which an e-mail address is verified is context specific, and dependent upon the trust framework or contractual agreements within which the parties are operating. */
  email_verified?: boolean;
  /** End-User's gender. Values defined by this specification are female and male. Other values MAY be used when neither of the defined values are applicable. */
  gender?: string;
  /** End-User's birthday, represented as an ISO 8601-1 [ISO8601‑1] YYYY-MM-DD format. The year MAY be 0000, indicating that it is omitted. To represent only the year, YYYY format is allowed. Note that depending on the underlying platform's date related function, providing just year can result in varying month and day, so the implementers need to take this factor into account to correctly process the dates. */
  birthdate?: string;
  /** String from IANA Time Zone Database [IANA.time‑zones] representing the End-User's time zone. For example, Europe/Paris or America/Los_Angeles. */
  zoneinfo?: string;
  /** End-User's locale, represented as a BCP47 [RFC5646] language tag. This is typically an ISO 639 Alpha-2 [ISO639] language code in lowercase and an ISO 3166-1 Alpha-2 [ISO3166‑1] country code in uppercase, separated by a dash. For example, en-US or fr-CA. As a compatibility note, some implementations have used an underscore as the separator rather than a dash, for example, en_US; Relying Parties MAY choose to accept this locale syntax as well */
  locale?: string;
  /** End-User's preferred telephone number. E.164 [E.164] is RECOMMENDED as the format of this Claim, for example, +1 (425) 555-1212 or +56 (2) 687 2400. If the phone number contains an extension, it is RECOMMENDED that the extension be represented using the RFC 3966 [RFC3966] extension syntax, for example, +1 (604) 555-1234;ext=5678. */
  phone_number?: string;
  /** True if the End-User's phone number has been verified; otherwise false. When this Claim Value is true, this means that the OP took affirmative steps to ensure that this phone number was controlled by the End-User at the time the verification was performed. The means by which a phone number is verified is context specific, and dependent upon the trust framework or contractual agreements within which the parties are operating. When true, the phone_number Claim MUST be in E.164 format and any extensions MUST be represented in RFC 3966 format. */
  phone_number_verified?: boolean;
  /** End-User's preferred postal address. The value of the address member is a JSON [RFC8259] structure containing some or all of the members defined in Section 5.1.1. */
  address?: unknown;
  /** Time the End-User's information was last updated. Its value is a JSON number representing the number of seconds from 1970-01-01T00:00:00Z as measured in UTC until the date/time. */
  updated_at?: number;

  /**
   * OpenId scopes present in the token, example value:
   * "openid email profile"
   */
  scope?: string;
}

/**
 * Structure in the tokens provided by keycloak that includes the roles assigned to a user in the realm
 */
export interface KeycloakTokenRealmRoles {
  realm_access: {
    roles: string[];
  };
}

export type KeycloakToken = KeycloakTokenRealmRoles & OidcClaims & JwtPayload;

export interface CacheTimer {
  /**
   * Called to signal the cache was filled with a new value
   * Since this is not called on every use but only on a new value the cache will cycle out values regularily, no matter how
   * much they are used. This way the jwks values should stay up to date.
   * The cache duration should be chosen such that maybe every few seconds the jwks values are validated this way,
   * the main purpose of the cache is to prevent a dozen queries in a single second
   */
  set: () => void;
  /**
   * Called to check the cache value should be used.
   * Calling check must not prevent invalidation of the cache value after some amount of time or some amount of use
   */
  check: () => boolean;

  /**
   * Should resolve after a short time while waiting for a pending cache refresh, suggest impl: sleep(5)
   */
  wait: () => Promise<void>;
}

export function buildTimedCacheTimer(
  timeoutSeconds = 10,
  getNow = () => Date.now(),
  sleeper = sleep
) {
  let lastCall = getNow();
  const result: CacheTimer = {
    set: () => (lastCall = getNow()),
    check: () => (getNow() - lastCall) / 1000 <= timeoutSeconds,
    wait: () => sleeper(5),
  };
  return result;
}

async function getPublicKey(jwksUri: string, kid: string) {
  const client = jwksClient({
    jwksUri,
    timeout: 30000,
  });

  const key = await client.getSigningKey(kid);
  const result = key.getPublicKey();
  return result;
}

export function getCachedKeyFactory(
  jwksUri: string,
  cacheTimer: CacheTimer,
  getKey = getPublicKey
) {
  let cache: Record<string, string> = {};
  const pendingSet = new Set<string>();

  async function waitForPending(key: string) {
    for (;;) {
      await cacheTimer.wait();
      if (!pendingSet.has(key)) {
        return;
      }
    }
  }

  async function getCachedKey(kid: string) {
    if (!cacheTimer.check()) {
      cache = {};
    }

    const cacheKey = kid;

    while (pendingSet.has(cacheKey)) {
      await waitForPending(cacheKey);
    }

    const cachedValue = cache[cacheKey];
    if (cachedValue != null) {
      return cachedValue;
    } else {
      pendingSet.add(cacheKey);
      const result = await getKey(jwksUri, kid);
      pendingSet.delete(cacheKey);

      cacheTimer.set();
      cache[cacheKey] = result;
      return result;
    }
  }

  return getCachedKey;
}

export function buildCachedValidateJwtFunction(
  jwksUri: string,
  cacheTimer: CacheTimer,
  getKey = getPublicKey,
  getNowSeconds = () => Math.floor(Date.now() / 1000)
) {
  const cachedKeys = getCachedKeyFactory(jwksUri, cacheTimer, getKey);

  async function validateJwt(token: string) {
    const decoded = jwt.decode(token, {
      complete: true,
    });

    if (decoded == null) {
      throw new Error('decoding failed');
    }

    if (typeof decoded.payload === 'string') {
      throw new Error('unexpected string payload ' + decoded.payload);
    }

    const kid = decoded.header.kid;
    if (kid == null) {
      throw new Error('missing key id in token');
    }

    const publicKey = await cachedKeys(kid);
    const validated = jwt.verify(token, publicKey, {
      complete: true,
      clockTimestamp: getNowSeconds(),
    });

    if (typeof validated.payload === 'string') {
      throw new Error('unexpected string payload ' + validated.payload);
    }

    return validated.payload as KeycloakToken;
  }

  return validateJwt;
}

export function buildTokenInformationForRequestFunction(
  jwksUri: string,
  cacheTimer: CacheTimer = buildTimedCacheTimer(),
  getKey = getPublicKey,
  getNowSeconds = () => Math.floor(Date.now() / 1000)
) {
  const BEARER = 'Bearer ';

  const func = buildCachedValidateJwtFunction(
    jwksUri,
    cacheTimer,
    getKey,
    getNowSeconds
  );

  return async (msg: IncomingMessage) => {
    const authHeader = msg.headers.authorization;
    if (authHeader == null || !authHeader.startsWith(BEARER)) {
      return undefined;
    }

    const jwt = authHeader.substring(BEARER.length).trim();

    try {
      return await func(jwt);
    } catch (e) {
      console.log('Failed to validate a token: ' + jwt, e);
      return undefined;
    }
  };
}

export const KeycloakAccessConfigSchema = z.object({
  jwksUri: z.string().url(),
  host: z.string(),
  user: z.string(),
  password: z.string(),
});

export type KeycloakAccessConfig = z.infer<typeof KeycloakAccessConfigSchema>;
