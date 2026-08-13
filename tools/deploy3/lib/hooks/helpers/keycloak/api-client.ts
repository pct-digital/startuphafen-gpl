/**
 * Keycloak API Client
 *
 * Shared utilities for interacting with the Keycloak REST API.
 */

export interface TokenResponse {
  access_token: string;
}

/**
 * Get an access token for the Keycloak Admin API.
 */
export async function getAccessToken(
  host: string,
  username: string,
  password: string
): Promise<string> {
  const tokenUrl = `${host}/realms/master/protocol/openid-connect/token`;

  const params = new URLSearchParams();
  params.append('client_id', 'admin-cli');
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to get access token: ${response.status} ${response.statusText} - ${text}`
    );
  }

  const resp = (await response.json()) as TokenResponse;
  return resp.access_token;
}
