/**
 * Odoo authentication service.
 *
 * Ports the login mechanism from the 369applications_admin app:
 *  - list databases:  POST {base}/web/database/list   -> { result: string[] }
 *  - authenticate:    POST {base}/web/session/authenticate
 *                     body { jsonrpc, method:'call', params:{ db, login, password } }
 *                     -> { result: { uid, name, username, ... } }  (uid truthy = success)
 * On React Native the platform keeps the session cookie in a shared jar, so
 * subsequent same-origin calls stay authenticated automatically.
 */

export type OdooUser = {
  uid: number;
  name?: string;
  username?: string;
  partner_id?: number;
  partner_display_name?: string;
  company_id?: number;
  odoo_db: string;
  base_url: string;
};

/** Add https:// if missing and strip trailing slashes. */
export function normalizeUrl(input: string): string {
  let u = (input || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '');
}

async function postJson(url: string, body: unknown, timeoutMs = 15000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('The server did not return JSON — check the URL.');
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Server timed out. Check the URL and network.');
    if (String(e?.message).includes('Network request failed'))
      throw new Error('Cannot reach the server. Check the URL and your network.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the list of databases on an Odoo server (empty if list_db is disabled). */
export async function listDatabases(baseUrl: string): Promise<string[]> {
  const url = normalizeUrl(baseUrl);
  if (!url) return [];
  const data = await postJson(`${url}/web/database/list`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  return Array.isArray(data?.result) ? data.result : [];
}

/** Authenticate against Odoo. Resolves to the user session or throws with a message. */
export async function authenticate(
  baseUrl: string,
  db: string,
  login: string,
  password: string,
): Promise<OdooUser> {
  const url = normalizeUrl(baseUrl);
  const data = await postJson(`${url}/web/session/authenticate`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { db, login, password },
  });
  if (data?.error) {
    const msg =
      data.error?.data?.message || data.error?.message || 'Login failed. Please try again.';
    throw new Error(msg);
  }
  const result = data?.result;
  if (!result || !result.uid) {
    throw new Error('Invalid credentials or login failed.');
  }
  return { ...result, odoo_db: db, base_url: url } as OdooUser;
}
