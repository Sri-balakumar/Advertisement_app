import base64
import re
import uuid

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


# A real web link: http(s) scheme + a dotted host (domain.tld). Rejects bare
# words like "abc" (which would otherwise become the unreachable "https://abc").
_URL_RE = re.compile(r'^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(/.*)?$', re.I)


class AdBanner(models.Model):
    _name = 'ad.banner'
    _description = 'Ad Carousel Item'
    _order = 'sequence, id'
    _rec_name = 'name'

    name = fields.Char(
        string='Ad Name', required=True,
        help="Internal label to recognise this ad (not shown to customers).")
    image = fields.Image(
        string='Ad Image', max_width=1920, max_height=1920,
        help="Artwork shown in the app carousel. Required for Image media type; "
             "for Video it is an optional poster.")
    sequence = fields.Integer(
        string='Sequence', default=10,
        help="Order in the carousel — smaller numbers show first.")
    active = fields.Boolean(string='Active', default=True)

    # --- QR handling -----------------------------------------------------------
    has_qr = fields.Boolean(
        string='Image or Video already has a QR', default=False,
        help="Tick this if the uploaded image or video already has a QR in it. "
             "The app then shows the ad full-screen. Leave it unticked to point "
             "the generated QR at a link, a file, or a product.")
    qr_source = fields.Selection(
        [('link', 'Website Link'),
         ('file', 'File / Document'),
         ('product', 'Product (live price)')],
        string='QR Points To', default='link', required=True,
        help="What the generated QR opens when scanned: a website link, a "
             "file/PDF/image you upload (which we host), or an Odoo product's "
             "live price page.")
    link_url = fields.Char(
        string='Link',
        help="Where the generated QR should take people (e.g. the advertiser's "
             "website). A bare domain gets https:// added; junk text is rejected.")
    qr_file = fields.Binary(
        string='File / Document', attachment=True,
        help="A PDF, image or any document. We host it and the QR opens it.")
    qr_filename = fields.Char(string='File Name')
    # Product target — the QR opens a live price page for this product.
    product_id = fields.Many2one(
        'product.template', string='Product', ondelete='set null',
        help="When 'QR Points To' is Product, the QR opens a live price page for "
             "this product (updates automatically when its price changes).")
    compare_price = fields.Float(
        string='Was Price (optional)',
        help="Optional 'before' price shown struck-through with the % off on the "
             "product page. Leave 0 to hide.")
    cta_phone = fields.Char(
        string='Contact Phone',
        help="Shown as WhatsApp + Call buttons on the product page.")
    # Media — an ad is an image (default) or an uploaded video clip.
    media_type = fields.Selection(
        [('image', 'Image'), ('video', 'Video')],
        string='Media Type', default='image', required=True,
        help="Image (default) or an uploaded video. The Ad Image is kept as the "
             "poster/fallback either way.")
    video = fields.Binary(
        string='Video', attachment=True,
        help="An uploaded video clip (e.g. MP4) played in the carousel.")
    video_filename = fields.Char(string='Video File Name')
    access_code = fields.Char(
        string='Access Code', required=True, copy=False, index=True,
        default=lambda self: uuid.uuid4().hex,
        help="Stable token used in the hosted file URL /ad/file/<code>.")
    qr_image = fields.Binary(
        string='Generated QR', compute='_compute_qr_image',
        store=True, attachment=True,
        help="Auto-generated from the Link or the hosted file. Shown under the "
             "image in the app when the image has no QR of its own.")

    # --- Carousel timing -------------------------------------------------------
    duration_mode = fields.Selection(
        [('auto', 'Auto'), ('custom', 'Custom')],
        string='Time on Screen', default='auto', required=True,
        help="How long this ad stays before the carousel scrolls on. "
             "Auto uses the app default; Custom uses the seconds below.")
    scroll_seconds = fields.Integer(
        string='Seconds', default=4,
        help="Seconds this ad stays on screen (used when Time on Screen is Custom).")

    # --- Scheduling ------------------------------------------------------------
    date_start = fields.Date(
        string='Start Date',
        help="Ad starts showing on this date. Empty = show immediately.")
    date_end = fields.Date(
        string='End Date',
        help="Ad stops showing after this date. Empty = no end.")
    is_live = fields.Boolean(
        string='Live now', compute='_compute_is_live', search='_search_is_live',
        help="True when the ad is active and within its scheduled dates.")

    # --- Scan analytics --------------------------------------------------------
    scan_ids = fields.One2many('ad.banner.scan', 'banner_id', string='Scans')
    scan_count = fields.Integer(string='Scans', compute='_compute_scan_count')

    _access_code_uniq = models.Constraint(
        'unique(access_code)',
        'The ad access code must be unique.',
    )

    # --- Link normalization ----------------------------------------------------

    @api.model
    def _normalize_link_url(self, url):
        """Bare domains (alphalize.com) get https:// so the QR opens correctly.
        Already-qualified http(s) links are left untouched. Full validation is
        done by the @api.constrains guard so bad text raises a friendly error."""
        if not url:
            return url
        url = url.strip()
        if url and not re.match(r'^https?://', url, re.I):
            url = 'https://' + url
        return url

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if 'link_url' in vals:
                vals['link_url'] = self._normalize_link_url(vals.get('link_url'))
        return super().create(vals_list)

    def write(self, vals):
        if 'link_url' in vals:
            vals['link_url'] = self._normalize_link_url(vals.get('link_url'))
        return super().write(vals)

    # --- Computes --------------------------------------------------------------

    def _file_url(self):
        self.ensure_one()
        return '%s/ad/file/%s' % (self.get_base_url(), self.access_code)

    def _landing_url(self):
        self.ensure_one()
        return '%s/ad/p/%s' % (self.get_base_url(), self.access_code)

    def _video_url(self):
        self.ensure_one()
        return '%s/ad/video/%s' % (self.get_base_url(), self.access_code)

    @api.depends('has_qr', 'qr_source', 'link_url', 'qr_file', 'product_id', 'access_code')
    def _compute_qr_image(self):
        # Odoo's built-in barcode() (reportlab, already a dependency) returns raw
        # PNG bytes. We only generate a QR when the image has none of its own; it
        # encodes either the link or the hosted-file URL.
        Report = self.env['ir.actions.report']
        for rec in self:
            target = False
            if not rec.has_qr:
                if rec.qr_source == 'link' and rec.link_url:
                    target = rec.link_url
                elif rec.qr_source == 'file' and rec.qr_file and rec.access_code:
                    target = rec._file_url()
                elif rec.qr_source == 'product' and rec.product_id and rec.access_code:
                    target = rec._landing_url()
            if not target:
                rec.qr_image = False
                continue
            png = Report.barcode('QR', target, width=256, height=256, barLevel='M')
            rec.qr_image = base64.b64encode(png)

    @api.depends('active', 'date_start', 'date_end')
    def _compute_is_live(self):
        today = fields.Date.context_today(self)
        for rec in self:
            rec.is_live = bool(
                rec.active
                and (not rec.date_start or rec.date_start <= today)
                and (not rec.date_end or today <= rec.date_end))

    def _search_is_live(self, operator, value):
        # is_live is computed (not stored) — translate a filter on it into a
        # domain over the underlying stored fields so it stays searchable.
        today = fields.Date.context_today(self)
        live = [
            ('active', '=', True),
            '|', ('date_start', '=', False), ('date_start', '<=', today),
            '|', ('date_end', '=', False), ('date_end', '>=', today),
        ]
        want_live = (operator in ('=', '==')) == bool(value)
        if want_live:
            return live
        # NOT live: inactive, or a future start, or a past end.
        return [
            '|', ('active', '=', False),
            '|', ('date_start', '>', today), ('date_end', '<', today),
        ]

    @api.depends('scan_ids')
    def _compute_scan_count(self):
        groups = self.env['ad.banner.scan']._read_group(
            [('banner_id', 'in', self.ids)],
            groupby=['banner_id'], aggregates=['__count'])
        counts = {banner.id: count for banner, count in groups}
        for rec in self:
            rec.scan_count = counts.get(rec.id, 0)

    # --- Validation ------------------------------------------------------------

    @api.constrains('has_qr', 'qr_source', 'link_url', 'qr_file', 'product_id')
    def _check_qr_target(self):
        for rec in self:
            if rec.has_qr:
                continue
            if rec.qr_source == 'link':
                if not rec.link_url:
                    raise ValidationError(_(
                        "Add a Link for “%s”, or tick “Image already has a QR”.",
                        rec.name or _('this ad')))
                if not _URL_RE.match(rec.link_url):
                    raise ValidationError(_(
                        "“%s” is not a valid web address. Use a real link like "
                        "https://alphalize.com (plain words such as “abc” are not "
                        "allowed).", rec.link_url))
            elif rec.qr_source == 'file' and not rec.qr_file:
                raise ValidationError(_(
                    "Upload a File / Document for “%s”, or switch the QR to a Link.",
                    rec.name or _('this ad')))
            elif rec.qr_source == 'product' and not rec.product_id:
                raise ValidationError(_(
                    "Choose a Product for “%s”, or switch the QR to a Link or File.",
                    rec.name or _('this ad')))

    @api.constrains('date_start', 'date_end')
    def _check_dates(self):
        for rec in self:
            if rec.date_start and rec.date_end and rec.date_end < rec.date_start:
                raise ValidationError(_("End Date cannot be before Start Date."))

    @api.constrains('media_type', 'video')
    def _check_video(self):
        for rec in self:
            if rec.media_type == 'video' and not rec.video:
                raise ValidationError(_(
                    "Upload a Video for “%s”, or set Media Type back to Image.",
                    rec.name or _('this ad')))

    @api.constrains('media_type', 'image')
    def _check_image(self):
        for rec in self:
            if rec.media_type == 'image' and not rec.image:
                raise ValidationError(_(
                    "Upload an Image for “%s” (Media Type is Image).",
                    rec.name or _('this ad')))

    # --- Actions ---------------------------------------------------------------

    def action_view_scans(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Scans'),
            'res_model': 'ad.banner.scan',
            'view_mode': 'list,form',
            'domain': [('banner_id', '=', self.id)],
            'context': {'default_banner_id': self.id, 'create': False},
        }
