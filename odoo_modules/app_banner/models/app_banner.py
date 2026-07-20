import base64
import re
import uuid

from odoo import _, api, models, fields
from odoo.exceptions import ValidationError


# A short code is a URL slug: lowercase letters, digits and hyphens only.
# Kept module-level so both the normalizer and the charset guard share it.
_ACCESS_CODE_RE = re.compile(r'^[a-z0-9-]+$')


class AppBanner(models.Model):
    _name = 'app.banner'
    _description = 'App Banner Image'
    # mail.thread powers the chatter on the form view so admins can audit
    # who changed which banner (image swap, archive, name edit).
    _inherit = ['mail.thread']
    # Newest-first — `sequence` is no longer surfaced in the UI (the mobile
    # app always sends 10), so ordering by it is meaningless. Keep the
    # field on the model to preserve the existing column + accept the
    # app's payload without errors.
    _order = 'id desc'
    _rec_name = 'name'

    name = fields.Char(string='Title', tracking=True)
    image = fields.Binary(
        string='Image',
        required=True,
        attachment=True,
        tracking=True,
    )
    image_filename = fields.Char(string='Filename')
    sequence = fields.Integer(string='Sequence', default=10)
    active = fields.Boolean(string='Active', default=True, tracking=True)

    # --- Product link + dynamic QR / short link --------------------------------
    # Each banner can point at a product. Scanning the QR (or tapping the
    # banner in the app) opens the public /b/<access_code> landing page, which
    # redirects THROUGH Odoo so the target stays editable without reprinting
    # the QR, and every open is logged (see app.banner.scan).
    # What a scan of /b/<code> shows. The QR always encodes the stable short
    # link, so switching this (or swapping the URL / PDF) never changes the QR
    # — the same printed/embedded code just points somewhere new. Dynamic.
    link_type = fields.Selection(
        [('product', 'Product Page'),
         ('url', 'Custom Link'),
         ('pdf', 'PDF Document')],
        string='On Scan Show', default='product', required=True, tracking=True,
        help="What a scan of this banner's QR opens: the product landing page, "
             "any website link, or an uploaded PDF. You can change this anytime "
             "without reprinting the QR.")
    product_id = fields.Many2one(
        'product.template', string='Linked Product',
        ondelete='set null', tracking=True,
        help="Product shown on the public landing page opened by the QR / short link.")
    target_url = fields.Char(
        string='Custom Link', tracking=True,
        help="For 'Custom Link': a scan redirects straight here (e.g. your "
             "company website). A bare domain gets https:// added automatically.")
    # Editable memorable slug (e.g. /b/summer-sale). Kept required + unique;
    # blank falls back to a uuid4 hex. create()/write() normalize it and an
    # @api.constrains guards the charset (see below).
    access_code = fields.Char(
        string='Access Code', required=True, copy=False, index=True,
        default=lambda self: uuid.uuid4().hex,
        help="Memorable short code used in the public link /b/<code>. "
             "Lowercase letters, numbers and hyphens only.")
    redirect_url = fields.Char(
        string='Short Link', compute='_compute_redirect_url')
    qr_image = fields.Binary(
        string='QR Code', compute='_compute_qr_image', store=True, attachment=True)
    scan_ids = fields.One2many('app.banner.scan', 'banner_id', string='Scans')
    scan_count = fields.Integer(string='Scans', compute='_compute_scan_count')

    # --- Detailed landing page: brochure, gallery, enquiry / CTA ---------------
    brochure = fields.Binary(
        string='Brochure (PDF)', attachment=True,
        help="Optional PDF shown as a Download button on the landing page.")
    brochure_filename = fields.Char(string='Brochure Filename')
    gallery_image_ids = fields.One2many(
        'app.banner.image', 'banner_id', string='Gallery Images',
        help="Extra photos shown as a swipeable gallery on the landing page.")
    cta_phone = fields.Char(
        string='Contact Phone',
        help="Shown as WhatsApp + Call buttons on the landing page.")
    enquiry_ids = fields.One2many(
        'app.banner.enquiry', 'banner_id', string='Enquiries')
    enquiry_count = fields.Integer(
        string='Enquiries', compute='_compute_enquiry_count')

    # Odoo 19 ignores the legacy `_sql_constraints` list (it only logs a
    # deprecation warning and never creates the constraint) — use the
    # models.Constraint table object so the uniqueness is actually enforced.
    _access_code_uniq = models.Constraint(
        'unique(access_code)',
        'That short code is already used by another banner. Pick a different one.',
    )

    # --- Short-code normalization + validation ---------------------------------

    @api.model
    def _normalize_access_code(self, code):
        """Turn user input into a URL-safe slug.

        Cosmetic only: lowercase, whitespace -> hyphen, collapse repeated
        hyphens and trim stray ones. Disallowed characters are deliberately
        left in place so the @api.constrains charset guard can reject them
        with a friendly message instead of silently mangling admin intent.
        Returns '' when nothing usable remains (caller falls back to uuid4).
        """
        if not code:
            return ''
        code = code.strip().lower()
        code = re.sub(r'\s+', '-', code)
        code = re.sub(r'-+', '-', code)
        return code.strip('-')

    @api.model
    def _normalize_target_url(self, url):
        """Make a pasted custom link work as an external redirect target.

        Bare domains (``alphalize.com``) get ``https://`` prepended so the
        browser treats them as absolute external URLs. Already-qualified
        ``http(s)://`` links and local ``/…`` paths are left untouched.
        """
        if not url:
            return url
        url = url.strip()
        if url and not re.match(r'^https?://', url, re.I) and not url.startswith('/'):
            url = 'https://' + url
        return url

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if 'access_code' in vals:
                vals['access_code'] = (
                    self._normalize_access_code(vals.get('access_code'))
                    or uuid.uuid4().hex)
            if 'target_url' in vals:
                vals['target_url'] = self._normalize_target_url(vals.get('target_url'))
        return super().create(vals_list)

    def write(self, vals):
        if 'access_code' in vals:
            vals['access_code'] = (
                self._normalize_access_code(vals.get('access_code'))
                or uuid.uuid4().hex)
        if 'target_url' in vals:
            vals['target_url'] = self._normalize_target_url(vals.get('target_url'))
        return super().write(vals)

    @api.constrains('access_code')
    def _check_access_code(self):
        for rec in self:
            if not rec.access_code or not _ACCESS_CODE_RE.match(rec.access_code):
                raise ValidationError(_(
                    "The short code “%s” is invalid. Use only lowercase "
                    "letters, numbers and hyphens — for example “summer-sale”.",
                    rec.access_code or ''))

    @api.depends('name')
    def _compute_display_name(self):
        # Keep the picker / breadcrumb readable even when admin hasn't
        # named the banner yet. Mirrors the mobile app's fallback at
        # BannersScreen.js (`Banner #${item.id}`). Replaces the pre-17
        # `name_get` override, which is dead code in Odoo 19.
        for rec in self:
            rec.display_name = rec.name or _('Banner #%s') % rec.id

    def _get_redirect_url(self):
        self.ensure_one()
        return f"{self.get_base_url()}/b/{self.access_code}" if self.access_code else False

    @api.depends('access_code')
    def _compute_redirect_url(self):
        for rec in self:
            rec.redirect_url = rec._get_redirect_url()

    @api.depends('access_code')
    def _compute_qr_image(self):
        # Odoo's built-in barcode() (reportlab, already a hard dependency)
        # returns raw PNG bytes — no external `qrcode` package needed. The QR
        # encodes only the stable /b/<code> path, so admins can repoint
        # product_id later without regenerating/reprinting the code.
        Report = self.env['ir.actions.report']
        for rec in self:
            if not rec.access_code:
                rec.qr_image = False
                continue
            png = Report.barcode(
                'QR', rec._get_redirect_url(),
                width=256, height=256, barLevel='M')
            rec.qr_image = base64.b64encode(png)

    @api.depends('scan_ids')
    def _compute_scan_count(self):
        groups = self.env['app.banner.scan']._read_group(
            [('banner_id', 'in', self.ids)],
            groupby=['banner_id'], aggregates=['__count'])
        counts = {banner.id: count for banner, count in groups}
        for rec in self:
            rec.scan_count = counts.get(rec.id, 0)

    @api.depends('enquiry_ids')
    def _compute_enquiry_count(self):
        groups = self.env['app.banner.enquiry']._read_group(
            [('banner_id', 'in', self.ids)],
            groupby=['banner_id'], aggregates=['__count'])
        counts = {banner.id: count for banner, count in groups}
        for rec in self:
            rec.enquiry_count = counts.get(rec.id, 0)

    # --- Header-button actions -------------------------------------------------

    def action_archive_banner(self):
        for rec in self:
            rec.active = False
        return True

    def action_unarchive_banner(self):
        for rec in self:
            rec.active = True
        return True

    def action_delete_banner(self):
        # The XML button uses confirm="..." so the Odoo client has already
        # asked the user to confirm by the time we get here. Drop the
        # record(s) and close the form.
        self.unlink()
        return {'type': 'ir.actions.act_window_close'}

    def action_view_scans(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Scans'),
            'res_model': 'app.banner.scan',
            'view_mode': 'list,form',
            'domain': [('banner_id', '=', self.id)],
            'context': {'default_banner_id': self.id, 'create': False},
        }

    def action_view_enquiries(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Enquiries'),
            'res_model': 'app.banner.enquiry',
            'view_mode': 'list,form',
            'domain': [('banner_id', '=', self.id)],
            'context': {'default_banner_id': self.id, 'create': False},
        }

    def action_create_product_from_banner(self):
        # Quick-create a product seeded from the banner (name + image), link it,
        # then open it in a dialog so the admin can add price / description.
        self.ensure_one()
        product = self.env['product.template'].create({
            'name': self.name or _('Banner Product'),
            'image_1920': self.image,
        })
        self.product_id = product.id
        return {
            'type': 'ir.actions.act_window',
            'name': _('New Product'),
            'res_model': 'product.template',
            'res_id': product.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def action_open_link(self):
        # Preview the public landing page the QR points to, in a new tab.
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': self.redirect_url,
            'target': 'new',
        }

    def action_download_qr(self):
        # Download the QR PNG (for printing / placing on a display).
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': '/web/image/app.banner/%d/qr_image?download=true'
                   '&filename=qr-banner-%d.png' % (self.id, self.id),
            'target': 'self',
        }
