# TASK PROMPT — paste this into a new Claude Code session

You are continuing work on an **Odoo 19 module** called `app_banner`. Implement the feature
described below **exactly**, then **deploy and verify it on the `sales_test` database**.
First read the module files, then implement, deploy with `-u`, and run an end-to-end test.
Work autonomously; you have admin rights on this machine.

---

## 1. What the module is / where it lives

`app_banner` manages a mobile app's home-carousel banners AND a QR/short-link feature:
each banner links to a product and gets a QR + short link `/b/<access_code>` that opens a
public product landing page; every scan is logged.

- **Source (edit here):** `C:\Users\sriba\OneDrive\Desktop\Advertisement_app\odoo_modules\app_banner`
- **Deployed copy Odoo actually loads:** `C:\Program Files\Odoo 19.0.20260119\server\odoo\addons\app_banner`
  (keep the two in sync — see deploy recipe).
- Current version: **19.0.4.0.0**, installed on db **`sales_test`**.
- Current model `app.banner` fields: `name`(Char), `image`(Binary attachment, required),
  `active`, `product_id`(M2o `product.template`, ondelete set null),
  `access_code`(Char, required, **readonly**, default `uuid4().hex`, unique via
  `_access_code_uniq = models.Constraint('unique(access_code)', ...)`),
  `redirect_url`(compute from access_code), `qr_image`(Binary compute+store from access_code,
  via `self.env['ir.actions.report'].barcode('QR', url, width=256, height=256, barLevel='M')`),
  `scan_ids`/`scan_count`. Model `app.banner.scan` logs scans. Controller `/b/<access_code>`
  (type=http, auth=public) resolves the banner (sudo, `active_test=False`), logs a scan, then
  renders `banner_landing_page` or a friendly `banner_unavailable_page` (no product/archived);
  unknown code → `request.not_found()`. Landing templates are **self-contained HTML** (own
  inline CSS). Manifest `depends = ['base','mail','product']`.

---

## 2. Environment + deploy recipe (READ — saves hours)

- Odoo install: `C:\Program Files\Odoo 19.0.20260119`
- odoo-bin: `...\server\odoo-bin`  | python: `...\python\python.exe`  | conf: `...\server\odoo.conf`
- Postgres (bundled): `...\PostgreSQL\bin\psql.exe`, user `openpg`, password `openpgpwd`, port 5432
- Runs as Windows service **`odoo-server-19.0`** in **MULTI-DB mode** (no dbfilter, many DBs).

**Deploy / upgrade recipe (PowerShell, admin):**
1. `Stop-Service odoo-server-19.0 -Force` (wait for Stopped).
2. Sync code with **robocopy** (do NOT use `Remove-Item` under `C:\Program Files` — a safety guard blocks it):
   `robocopy "<src>\app_banner" "<addons>\app_banner" /MIR /XD __pycache__`
3. `& "<python>" "<odoo-bin>" -c "<conf>" -d sales_test -u app_banner --stop-after-init --no-http --logfile <log>`  (exit 0 = ok; grep log for CRITICAL/ImportError/QWebError/ParseError, ignore `sms_error`).
4. `Start-Service odoo-server-19.0`.

**Testing the `/b/...` routes:** the main service is multi-DB, so `/b/<code>` 404s for an
anonymous request (no DB selected). To test, start a **temp mono-DB instance** and hit that:
`& python odoo-bin -c conf -d sales_test --db-filter=^sales_test$ --http-port=8070 --gevent-port=8073 --max-cron-threads=0 --logfile <log> --log-level=warn`
(start it hidden/background, poll `http://localhost:8070/web/login` for readiness, hit
`http://localhost:8070/b/<code>`, then kill the process).

**Running ORM/HTTP test scripts:** pipe a **bash heredoc** into `odoo-bin shell` using the
**Bash tool** with `< file` redirection. Do NOT pipe scripts via PowerShell — PowerShell
injects a UTF-8 BOM that makes `exec(sys.stdin.read())` fail with
`SyntaxError: invalid non-printable character U+FEFF`. In the shell, `env` is available;
call `env.cr.commit()` to persist. Generate test images with PIL (`Image.new(...).save(buf,'PNG')`)
— Odoo runs uploaded images through PIL and rejects malformed/truncated bytes.

**Build-specific gotchas (already verified — trust these):**
- `image_data_uri` is in `odoo.tools.image`, NOT `odoo.tools`.
- The legacy `_sql_constraints` list is **ignored** in this build (only logs a warning) — use
  `models.Constraint('unique(...)', 'msg')` class attributes.
- `web.frontend_layout` **crashes** here (its `portal.language_selector` footer →
  `NoneType has no len()`). Keep public templates **self-contained** (own inline CSS), no `t-call="web.frontend_layout"`.
- `product.template.name` is a translatable **JSONB** column (query `name->>'en_US'`);
  `app.banner.name` is plain varchar.
- `sales_test` installed modules: `product`, `sale`, `sale_management`, `contacts`, `mail`
  are installed; **`crm`, `website`, `website_sale` are NOT** (keep deps light).

---

## 3. Feature to implement

### A. Editable short code (slug) + quick-create product
1. Make `access_code` **editable** (drop `readonly`) as a memorable slug (e.g. `/b/summer-sale`):
   keep the `uuid4` default when blank; **normalize** in `create`/`write` (lowercase,
   spaces→hyphens, strip to `^[a-z0-9-]+`, collapse repeats, trim); keep the UNIQUE constraint
   (friendly collision message already works); add an `@api.constrains('access_code')` charset
   guard raising `ValidationError` (do NOT use a DB CHECK — ugly generic message). `redirect_url`
   and `qr_image` already `@api.depends('access_code')` so they recompute automatically.
   Add a UI warning that editing a code invalidates already-printed QRs.
2. On `product_id` change the widget options from `{'no_create': True}` to
   `{'no_create_edit': True}` (keeps native "Create 'X'" quick-create, drops the popup).
3. Add `action_create_product_from_banner`: creates a `product.template` seeded with
   `name=banner.name`, `image_1920=banner.image`, sets `self.product_id`, and returns an
   `act_window` opening that product in `target:'new'` (dialog) to add price/description.
   Add a "Create Product from Banner" button, visible only when `product_id` is empty.

### B. Detailed landing page: PDF + image gallery + enquiry/CTA
- **PDF:** add `brochure`(Binary attachment) + `brochure_filename`(Char). New public route
  `/b/<access_code>/pdf` streams it via
  `request.env['ir.binary'].sudo()._get_stream_from(banner,'brochure',filename=...,filename_field='brochure_filename',mimetype='application/pdf').get_response(as_attachment=True)`.
  Landing shows a "Download PDF" button only when set.
- **Gallery:** new model `app.banner.image` inheriting `image.mixin` (fields: `banner_id`
  M2o cascade, `sequence`, `name`, redeclare `image_1920 = fields.Image()`) — pattern copied
  from `website_sale/models/product_image.py`. Landing renders a CSS scroll-snap carousel
  (no JS) using data URIs (`image_data_uri(img.image_512)`). Form manages them via a one2many
  kanban with a `sequence` handle.
- **Enquiry/CTA:** add `cta_phone`(Char) → render WhatsApp (`https://wa.me/<digits>`) + Call
  (`tel:+<digits>`) buttons when set. Add a **self-contained** model `app.banner.enquiry`
  (`banner_id` cascade, `name` required, `phone`, `message`) — do NOT add a `crm` dependency.
  Landing page has an enquiry `<form method="post" action="/b/<code>/enquiry">` with a hidden
  `csrf_token` (`request.csrf_token()`), a hidden honeypot field, and name/phone/message inputs.
  New route `/b/<access_code>/enquiry` (type=http, auth=public, methods=['POST']) validates
  (honeypot + required name/phone), `sudo().create`s the enquiry, and redirects to
  `/b/<code>?sent=1` (show a "Thanks!" note). Add an **Enquiries** smart button + list view + menu.

### Security / manifest
- Add ACL rows for `app.banner.image` and `app.banner.enquiry` (managers R/W, `base.group_user`
  read-only). NO public ACL — anonymous enquiry inserts go through `sudo()` in the controller
  (same pattern as `app.banner.scan`).
- `depends` stays `['base','mail','product']` (image.mixin is in `base`). Add the new enquiry
  view file to `data`. Bump `version` to `19.0.5.0.0`. No migration script needed.

---

## 4. Verify (end-to-end on `sales_test`)
After `-u app_banner`, using a temp mono-DB instance on :8070, confirm via an `odoo-bin shell`
script (bash heredoc):
1. Create a banner with a custom code like `test-slug` + a product → `/b/test-slug` returns
   **200** and shows the product; the QR/redirect_url use the custom slug.
2. Attach a PDF → `/b/test-slug/pdf` returns 200 with `Content-Disposition: attachment`.
3. Add 2–3 gallery images → they appear in the landing HTML.
4. POST to `/b/test-slug/enquiry` with name+phone → an `app.banner.enquiry` row is created and
   the response redirects to `?sent=1`; honeypot-filled POST is ignored.
5. Duplicate slug → friendly uniqueness error; bad charset → ValidationError.
6. Clean up all test records afterward (leave existing banners intact). Confirm the module
   ends `installed 19.0.5.0.0` and the main service is running.

A full, source-verified file-by-file design (with code snippets and the exact Odoo-19
references) was produced for this task — follow the spec above; re-verify anything uncertain
against the installed source at `C:\Program Files\Odoo 19.0.20260119\server`.
