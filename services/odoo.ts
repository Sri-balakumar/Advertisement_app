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
  // Fix an IP typed with the port after a dot, e.g. 192.168.1.5.8069 ->
  // 192.168.1.5:8069 (matches the desktop admin app's LoginScreenOdoo handling,
  // so /web/database/list resolves and the DB dropdown populates).
  u = u.replace(/(\d+\.\d+\.\d+\.\d+)\.(\d+)(\/.*)?$/, '$1:$2$3');
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

// ---- Signage Scan module -------------------------------------------------

/** One signage banner (from /signage/banners). */
export type SignageBanner = {
  id: number;
  name: string;
  media_type: 'image' | 'video';
  image: string | false;
  video: string | false;
  scroll_seconds: number | false;
};

/** Live signage banners for the full-screen display. */
export async function getSignageBanners(baseUrl: string): Promise<SignageBanner[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/banners`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error)
    throw new Error(data.error?.data?.message || data.error?.message || 'Could not load banners.');
  return Array.isArray(data?.result) ? data.result : [];
}

/** One label:value row in a scanned product's detail. */
export type ProductRow = { label: string; value: string };

/** Result of scanning a product barcode (from /signage/lookup). */
export type ProductLookup = {
  found: boolean;
  name: string;
  image: string | false;
  rows: ProductRow[];
  /** How long to keep the detail on screen (seconds), from the shared setting. */
  detail_seconds: number;
};

/** The shared 'detail display time' setting. */
export type DetailConfig = { value: number; unit: 'sec' | 'min'; seconds: number };

export async function getDetailConfig(baseUrl: string): Promise<DetailConfig> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/detail/get`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  const r = data?.result || {};
  return {
    value: Number(r.value) || 8,
    unit: r.unit === 'min' ? 'min' : 'sec',
    seconds: Number(r.seconds) || 8,
  };
}

export async function setDetailConfig(
  baseUrl: string,
  value: number,
  unit: 'sec' | 'min',
): Promise<DetailConfig> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/detail/set`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { value, unit },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not save.'));
  const r = data?.result || {};
  if (r?.error) throw new Error(r.error);
  return {
    value: Number(r.value) || value,
    unit: r.unit === 'min' ? 'min' : 'sec',
    seconds: Number(r.seconds) || value,
  };
}

/** Look up a product by barcode; returns the admin-selected fields for it. */
export async function lookupProduct(baseUrl: string, barcode: string): Promise<ProductLookup> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/lookup`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { barcode },
  });
  if (data?.error)
    throw new Error(data.error?.data?.message || data.error?.message || 'Lookup failed.');
  const r = data?.result || {};
  return {
    found: !!r.found,
    name: r.name || '',
    image: r.image ?? false,
    rows: Array.isArray(r.rows)
      ? r.rows.map((x: any) => ({ label: x.label || '', value: x.value ?? '' }))
      : [],
    detail_seconds: Number(r.detail_seconds) || 8,
  };
}

// ---- Signage management (managers only) ----------------------------------

function errOf(data: any, fallback: string): string {
  return data?.error?.data?.message || data?.error?.message || fallback;
}

/** Whether the signed-in user may manage signage (create rights). */
export async function signageCanManage(baseUrl: string): Promise<boolean> {
  try {
    const data = await postJson(`${normalizeUrl(baseUrl)}/signage/can_manage`, {
      jsonrpc: '2.0',
      method: 'call',
      params: {},
    });
    return data?.result === true;
  } catch {
    return false;
  }
}

/** Dashboard counts for the Manage overview. */
export type SignageStats = {
  banners_total: number;
  banners_live: number;
  banners_video: number;
  banners_image: number;
  products_total: number;
  products_on_scan: number;
};

export async function getSignageStats(baseUrl: string): Promise<SignageStats> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/stats`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  const r = data?.result || {};
  return {
    banners_total: Number(r.banners_total) || 0,
    banners_live: Number(r.banners_live) || 0,
    banners_video: Number(r.banners_video) || 0,
    banners_image: Number(r.banners_image) || 0,
    products_total: Number(r.products_total) || 0,
    products_on_scan: Number(r.products_on_scan) || 0,
  };
}

/** One banner card for the app's manage screen. */
export type ManageBanner = {
  id: number;
  name: string;
  media_type: 'image' | 'video';
  active: boolean;
  is_live: boolean;
  thumb: string | false;
  has_video: boolean;
  /** Streamable video path (manager route), or false. */
  video: string | false;
};

/** All banners (incl. archived) for the manage card grid. */
export async function getManageBanners(baseUrl: string): Promise<ManageBanner[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/banners/manage`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load banners.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return Array.isArray(r?.banners)
    ? r.banners.map((b: any) => ({
        id: b.id,
        name: b.name || '',
        media_type: b.media_type,
        active: !!b.active,
        is_live: !!b.is_live,
        thumb: b.thumb ?? false,
        has_video: !!b.has_video,
        video: b.video ?? false,
      }))
    : [];
}

/** Full banner detail for the app's create/edit form. */
export type BannerDetail = {
  id: number;
  name: string;
  media_type: 'image' | 'video';
  image: string | false;
  has_video: boolean;
  video: string | false;
  video_filename: string;
  duration_mode: 'auto' | 'custom';
  scroll_seconds: number;
  sequence: number;
  active: boolean;
  date_start: string;
  date_end: string;
};

export async function getBannerDetail(baseUrl: string, bannerId: number): Promise<BannerDetail> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/banner/get`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { banner_id: bannerId },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load the banner.'));
  const r = data?.result;
  if (!r || r.error) throw new Error(r?.error || 'Banner not found.');
  return {
    id: r.id,
    name: r.name || '',
    media_type: r.media_type,
    image: r.image ?? false,
    has_video: !!r.has_video,
    video: r.video ?? false,
    video_filename: r.video_filename || '',
    duration_mode: r.duration_mode || 'auto',
    scroll_seconds: r.scroll_seconds || 6,
    sequence: r.sequence || 10,
    active: !!r.active,
    date_start: r.date_start || '',
    date_end: r.date_end || '',
  };
}

/** Fields the app sends to create/update a banner (media = bare base64/data URI). */
export type BannerSave = {
  banner_id?: number;
  name: string;
  media_type: 'image' | 'video';
  image?: string;
  video?: string;
  video_filename?: string;
  duration_mode: 'auto' | 'custom';
  scroll_seconds?: number;
  sequence?: number;
  active: boolean;
  date_start?: string;
  date_end?: string;
};

export async function saveBanner(
  baseUrl: string,
  payload: BannerSave,
): Promise<{ id: number; name: string }> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/banner/save`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { ...payload },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not save the banner.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  if (!r?.id) throw new Error('Could not save the banner.');
  return { id: r.id, name: r.name };
}

/** One product field available to add on scan (the app's field picker). */
export type ProductField = { field_id: number; name: string; label: string; ttype: string };

/** Every product field that can be shown on scan (for 'Add field'). */
export async function getProductFields(baseUrl: string): Promise<ProductField[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/fields`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load fields.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return Array.isArray(r?.fields)
    ? r.fields.map((f: any) => ({
        field_id: f.field_id,
        name: f.name || '',
        label: f.label || '',
        ttype: f.ttype || '',
      }))
    : [];
}

/** One product row for the Scan Fields list. */
export type ScanProduct = {
  id: number;
  name: string;
  barcode: string;
  signage_enabled: boolean;
  thumb: string | false;
};

/** Products with their master on/off state (the app's Scan Fields list). */
export async function getScanProducts(baseUrl: string, query = ''): Promise<ScanProduct[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/products`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { query },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load products.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return Array.isArray(r?.products)
    ? r.products.map((p: any) => ({
        id: p.id,
        name: p.name || '',
        barcode: p.barcode || '',
        signage_enabled: !!p.signage_enabled,
        thumb: p.thumb ?? false,
      }))
    : [];
}

/** Quick master on/off for a product from the Scan Fields list. */
export async function toggleScanProduct(
  baseUrl: string,
  tmplId: number,
  enabled: boolean,
): Promise<boolean> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/product/toggle`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { tmpl_id: tmplId, enabled },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not update.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return r?.ok === true;
}

/** One field toggle row in a product's scan config. */
export type ScanConfigField = {
  line_id: number;
  field_id: number;
  name: string;
  label: string;
  show: boolean;
};

/** A product's full scan config (every option the module has). */
export type ScanProductConfig = {
  id: number;
  name: string;
  barcode: string;
  image: string | false;
  signage_enabled: boolean;
  signage_show_image: boolean;
  fields: ScanConfigField[];
};

export async function getScanProductConfig(
  baseUrl: string,
  tmplId: number,
): Promise<ScanProductConfig> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/product/get`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { tmpl_id: tmplId },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load the product.'));
  const r = data?.result;
  if (!r || r.error) throw new Error(r?.error || 'Product not found.');
  return {
    id: r.id,
    name: r.name || '',
    barcode: r.barcode || '',
    image: r.image ?? false,
    signage_enabled: !!r.signage_enabled,
    signage_show_image: !!r.signage_show_image,
    fields: Array.isArray(r.fields)
      ? r.fields.map((f: any) => ({
          line_id: f.line_id,
          field_id: f.field_id,
          name: f.name || '',
          label: f.label || '',
          show: !!f.show,
        }))
      : [],
  };
}

export async function saveScanProductConfig(
  baseUrl: string,
  payload: {
    tmpl_id: number;
    signage_enabled: boolean;
    signage_show_image: boolean;
    fields: { field_id: number; show: boolean }[];
  },
): Promise<boolean> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/product/save`, {
    jsonrpc: '2.0',
    method: 'call',
    params: payload,
  });
  if (data?.error) throw new Error(errOf(data, 'Could not save.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return r?.ok === true;
}

/** Global scan-fields config: one shared field set shown for every product. */
export type GlobalScanFields = { mode: boolean; fields: ScanConfigField[] };

/** Read the global scan-fields mode + shared field list. */
export async function getGlobalScanFields(baseUrl: string): Promise<GlobalScanFields> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/global_fields/get`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load global fields.'));
  const r = data?.result || {};
  return {
    mode: !!r.mode,
    fields: Array.isArray(r.fields)
      ? r.fields.map((f: any) => ({
          line_id: f.line_id,
          field_id: f.field_id,
          name: f.name || '',
          label: f.label || '',
          show: !!f.show,
        }))
      : [],
  };
}

/** Save the global mode and (optionally) the shared field list. Pass only
 *  `mode` to flip the toggle without touching the list. */
export async function setGlobalScanFields(
  baseUrl: string,
  payload: { mode: boolean; fields?: { field_id: number; show: boolean }[] },
): Promise<boolean> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/global_fields/set`, {
    jsonrpc: '2.0',
    method: 'call',
    params: payload,
  });
  if (data?.error) throw new Error(errOf(data, 'Could not save.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return r?.ok === true;
}

// ---- Product create / edit (admins only) ---------------------------------

/** A product category (or unit) for a picker. */
export type ProductCategory = { id: number; name: string };
export type ProductUom = { id: number; name: string };

export async function getCategories(baseUrl: string): Promise<ProductCategory[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/categories`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load categories.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return Array.isArray(r?.categories)
    ? r.categories.map((x: any) => ({ id: x.id, name: x.name || '' }))
    : [];
}

export async function getUoms(baseUrl: string): Promise<ProductUom[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/uoms`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {},
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load units.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return Array.isArray(r?.uoms) ? r.uoms.map((x: any) => ({ id: x.id, name: x.name || '' })) : [];
}

/** One custom (manual) product field shown dynamically on the form. */
export type CustomField = {
  name: string;
  label: string;
  ttype: 'char' | 'text' | 'float' | 'monetary' | 'integer' | 'boolean' | 'selection' | 'many2one' | 'date' | 'datetime' | string;
  value: string | number | boolean;
  /** selection: [value, label] options. */
  options?: [string, string][];
  /** many2one: related model + current record's display name. */
  relation?: string;
  value_label?: string;
};

/** One related-model record for a many2one custom-field picker. */
export type RelationRecord = { id: number; name: string };

export async function getRelationRecords(
  baseUrl: string,
  model: string,
  query = '',
): Promise<RelationRecord[]> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/relation/search`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { model, query },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load records.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return Array.isArray(r?.records) ? r.records.map((x: any) => ({ id: x.id, name: x.name || '' })) : [];
}

/** Editable product basics (from /signage/product/basic/get). */
export type ProductBasics = {
  id: number;
  name: string;
  barcode: string;
  list_price: number;
  standard_price: number;
  categ_id: number | false;
  categ_name: string;
  default_code: string;
  uom_id: number | false;
  uom_name: string;
  description_sale: string;
  image: string | false;
  custom_fields: CustomField[];
};

export async function getProductBasics(baseUrl: string, tmplId: number): Promise<ProductBasics> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/product/basic/get`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { tmpl_id: tmplId },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not load the product.'));
  const r = data?.result;
  if (!r || r.error) throw new Error(r?.error || 'Product not found.');
  return {
    id: r.id,
    name: r.name || '',
    barcode: r.barcode || '',
    list_price: Number(r.list_price) || 0,
    standard_price: Number(r.standard_price) || 0,
    categ_id: r.categ_id ?? false,
    categ_name: r.categ_name || '',
    default_code: r.default_code || '',
    uom_id: r.uom_id ?? false,
    uom_name: r.uom_name || '',
    description_sale: r.description_sale || '',
    image: r.image ?? false,
    custom_fields: Array.isArray(r.custom_fields)
      ? r.custom_fields.map((f: any) => ({
          name: f.name,
          label: f.label || f.name,
          ttype: f.ttype,
          value: f.value,
          options: Array.isArray(f.options) ? f.options : undefined,
          relation: f.relation || undefined,
          value_label: f.value_label || undefined,
        }))
      : [],
  };
}

/** Fields the app sends to create/update a product (image = bare base64/data URI). */
export type ProductInput = {
  name: string;
  barcode?: string;
  list_price?: number;
  standard_price?: number;
  categ_id?: number;
  default_code?: string;
  uom_id?: number;
  description_sale?: string;
  image?: string;
  /** Custom (manual) product fields: { field_name: value }. */
  custom?: Record<string, string | number | boolean>;
};

export async function createProduct(
  baseUrl: string,
  payload: ProductInput,
): Promise<{ id: number; name: string }> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/product/create`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { ...payload },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not create the product.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  if (!r?.id) throw new Error('Could not create the product.');
  return { id: r.id, name: r.name };
}

export async function saveProductBasics(
  baseUrl: string,
  tmplId: number,
  payload: ProductInput,
): Promise<boolean> {
  const data = await postJson(`${normalizeUrl(baseUrl)}/signage/product/basic/save`, {
    jsonrpc: '2.0',
    method: 'call',
    params: { tmpl_id: tmplId, ...payload },
  });
  if (data?.error) throw new Error(errOf(data, 'Could not save the product.'));
  const r = data?.result;
  if (r?.error) throw new Error(r.error);
  return r?.ok === true;
}
