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
      // include cookies so session-authenticated routes (auth='user', e.g.
      // /ad/carousel) ride the login session set by /web/session/authenticate.
      credentials: 'include',
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

/** One ad in the mobile carousel (shape returned by POST /ad/carousel). */
export type AdItem = {
  id: number;
  name: string;
  has_qr: boolean;
  qr_source: 'link' | 'file' | 'product';
  link_url: string | false;
  /** Full ad artwork as a data: URI (poster/fallback for video). */
  image: string | false;
  /** Generated QR as a data: URI — only present when the image has no baked-in QR. */
  qr: string | false;
  /** Custom seconds on screen, or false = use the app default. */
  scroll_seconds: number | false;
  /** 'image' (default) or 'video'. */
  media_type: 'image' | 'video';
  /** Streamable video URL when media_type === 'video', else false. */
  video: string | false;
  /** Live product-price page URL when qr_source === 'product', else false. */
  landing_url: string | false;
};

/**
 * Fetch the live ad carousel for the logged-in session.
 * Calls the `ad_carousel` module's JSON-RPC route (auth='user'); the session
 * cookie from login authenticates it, so no credentials are passed here.
 */
export async function fetchCarousel(baseUrl: string): Promise<AdItem[]> {
  const url = normalizeUrl(baseUrl);
  const data = await postJson(`${url}/ad/carousel`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error) {
    const msg = data.error?.data?.message || data.error?.message || 'Could not load ads.';
    throw new Error(msg);
  }
  return Array.isArray(data?.result) ? data.result : [];
}

/** Whether the signed-in user may create ads (admins/managers only). */
export async function canManageAds(baseUrl: string): Promise<boolean> {
  try {
    const data = await postJson(`${normalizeUrl(baseUrl)}/ad/can_manage`, {
      jsonrpc: '2.0',
      method: 'call',
      params: {},
    });
    return data?.result === true;
  } catch {
    return false;
  }
}

export type OdooProduct = { id: number; name: string; price: number; currency: string };

/** Search products for the app's product picker (needs a logged-in session). */
export async function searchProducts(baseUrl: string, query = ''): Promise<OdooProduct[]> {
  try {
    const data = await postJson(`${normalizeUrl(baseUrl)}/ad/products`, {
      jsonrpc: '2.0',
      method: 'call',
      params: { query, limit: 40 },
    });
    return Array.isArray(data?.result) ? data.result : [];
  } catch {
    return [];
  }
}

/** Full ad payload the admin panel can create (base64 for image/video/file). */
export type NewAd = {
  name: string;
  media_type: 'image' | 'video';
  image?: string;
  video?: string;
  video_filename?: string;
  has_qr: boolean;
  qr_source: 'link' | 'file' | 'product';
  link_url?: string;
  qr_file?: string;
  qr_filename?: string;
  product_id?: number;
  compare_price?: number;
  cta_phone?: string;
  duration_mode: 'auto' | 'custom';
  scroll_seconds?: number;
  sequence?: number;
  active: boolean;
  date_start?: string;
  date_end?: string;
};

/** Create a carousel ad. Throws with a friendly message on validation/permission errors. */
export async function createAd(baseUrl: string, ad: NewAd): Promise<{ id: number; name: string }> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/create`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { ...ad },
  });
  // Transport-level JSON-RPC error.
  if (data?.error) {
    throw new Error(data.error?.data?.message || data.error?.message || 'Could not add the ad.');
  }
  const result = data?.result;
  // Handled application error returned as { error: '...' }.
  if (result?.error) throw new Error(result.error);
  if (!result?.id) throw new Error('Could not add the ad.');
  return result;
}

/** One ad row for the admin list/dashboard. */
export type AdListItem = {
  id: number;
  name: string;
  media_type: 'image' | 'video';
  active: boolean;
  is_live: boolean;
  has_qr: boolean;
  qr_source: 'link' | 'file' | 'product';
  thumb: string | false;
};

/** Every ad (incl. archived) for the admin dashboard. */
export async function listAds(baseUrl: string): Promise<AdListItem[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/list`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error)
    throw new Error(data.error?.data?.message || data.error?.message || 'Could not load ads.');
  return Array.isArray(data?.result) ? data.result : [];
}

/** Full ad detail for the edit form. */
export type AdDetail = {
  id: number;
  name: string;
  media_type: 'image' | 'video';
  image: string | false;
  has_video: boolean;
  video: string | false;
  video_filename: string;
  has_qr: boolean;
  qr_source: 'link' | 'file' | 'product';
  link_url: string;
  has_file: boolean;
  qr_filename: string;
  product_id: number | false;
  product_name: string;
  compare_price: number;
  cta_phone: string;
  duration_mode: 'auto' | 'custom';
  scroll_seconds: number;
  sequence: number;
  active: boolean;
  date_start: string;
  date_end: string;
};

export async function getAdDetail(baseUrl: string, adId: number): Promise<AdDetail> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/detail`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { ad_id: adId },
  });
  if (data?.error)
    throw new Error(data.error?.data?.message || data.error?.message || 'Could not load the ad.');
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  if (!r?.id) throw new Error('Ad not found.');
  return r;
}

/** Update an existing ad. Media is only replaced when new base64 is included. */
export async function updateAd(
  baseUrl: string,
  adId: number,
  ad: Partial<NewAd>,
): Promise<{ id: number; name: string }> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/update`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { ad_id: adId, ...ad },
  });
  if (data?.error)
    throw new Error(data.error?.data?.message || data.error?.message || 'Could not save the ad.');
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  if (!r?.id) throw new Error('Could not save the ad.');
  return r;
}

/** One labelled contact email shown in Help & Support (e.g. HR, Sales). */
export type AppContact = { label: string; email: string };

/**
 * Editable Profile content stored on the Odoo server (ad_carousel module):
 * the company address, the About write-up and any number of contact emails.
 */
export type AppSettings = {
  address: string;
  about_title: string;
  about_body: string;
  phone: string;
  emails: AppContact[];
};

/** Load the app settings (address / about / contact emails) shown in Profile. */
export async function getAppSettings(baseUrl: string): Promise<AppSettings> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/settings`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error)
    throw new Error(data.error?.data?.message || data.error?.message || 'Could not load settings.');
  const r = data?.result || {};
  return {
    address: r.address || '',
    about_title: r.about_title || '',
    about_body: r.about_body || '',
    phone: r.phone || '',
    emails: Array.isArray(r.emails)
      ? r.emails.map((e: any) => ({ label: e?.label || '', email: e?.email || '' }))
      : [],
  };
}

/**
 * Save the app settings. The server runs the write with the user's own rights,
 * so only an admin/manager can persist — a non-manager gets a friendly error.
 */
export async function saveAppSettings(baseUrl: string, s: AppSettings): Promise<boolean> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/settings/save`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      address: s.address,
      about_title: s.about_title,
      about_body: s.about_body,
      phone: s.phone,
      emails: s.emails,
    },
  });
  if (data?.error)
    throw new Error(data.error?.data?.message || data.error?.message || 'Could not save.');
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return r?.ok === true;
}

/** One ad's scan count for the Insights dashboard. */
export type AdScanStat = { id: number; name: string; count: number };
export type CountryStat = { name: string; count: number };
export type DayStat = { date: string; count: number };

/** Scan analytics for the admin Insights dashboard. */
export type ScanAnalytics = {
  total: number;
  last7: number;
  prev7: number;
  last30: number;
  per_ad: AdScanStat[];
  by_country: CountryStat[];
  by_day: DayStat[];
};

/** Load scan analytics (admins only — the server returns an error for non-managers). */
export async function getScanAnalytics(baseUrl: string): Promise<ScanAnalytics> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/analytics`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error)
    throw new Error(
      data.error?.data?.message || data.error?.message || 'Could not load analytics.',
    );
  const r = data?.result || {};
  if (r?.error) throw new Error(r.error);
  return {
    total: r.total || 0,
    last7: r.last7 || 0,
    prev7: r.prev7 || 0,
    last30: r.last30 || 0,
    per_ad: Array.isArray(r.per_ad)
      ? r.per_ad.map((a: any) => ({ id: a.id, name: a.name || '', count: a.count || 0 }))
      : [],
    by_country: Array.isArray(r.by_country)
      ? r.by_country.map((c: any) => ({ name: c.name || '', count: c.count || 0 }))
      : [],
    by_day: Array.isArray(r.by_day)
      ? r.by_day.map((d: any) => ({ date: d.date || '', count: d.count || 0 }))
      : [],
  };
}

/** One enquiry (lead) submitted from a scanned product landing page. */
export type AppEnquiry = {
  id: number;
  name: string;
  phone: string;
  message: string;
  ad: string;
  product: string;
  date: string;
  handled: boolean;
};

/** Load enquiries/leads for the app admin list (admins only). */
export async function getEnquiries(baseUrl: string): Promise<AppEnquiry[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/ad/enquiries`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error)
    throw new Error(
      data.error?.data?.message || data.error?.message || 'Could not load enquiries.',
    );
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return Array.isArray(r)
    ? r.map((e: any) => ({
        id: e.id,
        name: e.name || '',
        phone: e.phone || '',
        message: e.message || '',
        ad: e.ad || '',
        product: e.product || '',
        date: e.date || '',
        handled: !!e.handled,
      }))
    : [];
}
