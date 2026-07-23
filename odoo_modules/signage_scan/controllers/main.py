import json
import logging

from odoo import fields, http
from odoo.exceptions import UserError, ValidationError
from odoo.http import request
from odoo.tools.image import image_data_uri

_logger = logging.getLogger(__name__)


class SignageController(http.Controller):

    def _live_domain(self):
        today = fields.Date.context_today(request.env['signage.banner'].sudo())
        # `show_on_display` is the simple on/off toggle (not archiving). Archived
        # records (active=False) are already excluded by the default active_test.
        return [
            ('show_on_display', '=', True),
            '|', ('date_start', '=', False), ('date_start', '<=', today),
            '|', ('date_end', '=', False), ('date_end', '>=', today),
        ]

    # ---- Banners ----------------------------------------------------------

    @http.route('/signage/banners', type='jsonrpc', auth='user', methods=['POST'])
    def signage_banners(self, **kw):
        """Live banners for the app's full-screen signage carousel."""
        banners = request.env['signage.banner'].sudo().search(self._live_domain())
        return [{
            'id': b.id,
            'name': b.name,
            'media_type': b.media_type,
            'image': image_data_uri(b.image) if b.image else False,
            'video': b._video_url() if b.media_type == 'video' and b.video else False,
            'scroll_seconds': b.scroll_seconds if b.duration_mode == 'custom' else False,
        } for b in banners]

    @http.route('/signage/video/<string:access_code>', type='http', auth='public', methods=['GET'])
    def signage_video(self, access_code, **kw):
        """Stream a banner's video (the app downloads it through its logged-in
        session; a multi-DB server can't resolve an anonymous request)."""
        b = request.env['signage.banner'].sudo().search(
            self._live_domain() + [('access_code', '=', access_code)], limit=1)
        if not b or not b.video:
            return request.not_found()
        filename = b.video_filename or ('signage-%s.mp4' % b.access_code)
        return request.env['ir.binary'].sudo()._get_stream_from(
            b, 'video', filename=filename, filename_field='video_filename',
        ).get_response(as_attachment=False)

    @http.route('/signage/video_admin/<int:banner_id>', type='http', auth='user', methods=['GET'])
    def signage_video_admin(self, banner_id, **kw):
        """Stream a banner's video for the admin form's inline preview — works for
        any banner (even not-yet-live/archived), managers only."""
        if not self._is_manager():
            return request.not_found()
        b = request.env['signage.banner'].sudo().browse(banner_id)
        if not b.exists() or not b.video:
            return request.not_found()
        filename = b.video_filename or ('signage-%s.mp4' % b.access_code)
        return request.env['ir.binary'].sudo()._get_stream_from(
            b, 'video', filename=filename, filename_field='video_filename',
        ).get_response(as_attachment=False)

    @http.route('/signage/preview', type='http', auth='user', methods=['GET'])
    def signage_preview(self, **kw):
        """In-Odoo phone-frame preview of the banner display — what the app shows.
        The admin's browser carries the session, so banner videos play here."""
        banners = request.env['signage.banner'].sudo().search(self._live_domain())
        payload = [{
            'id': b.id,
            'name': b.name,
            'media_type': b.media_type,
            'image': image_data_uri(b.image) if b.image else False,
            'video': b._video_url() if b.media_type == 'video' and b.video else False,
            'scroll_seconds': b.scroll_seconds if b.duration_mode == 'custom' else False,
        } for b in banners]
        return request.render('signage_scan.signage_preview_page', {
            'banners_json': json.dumps(payload),
            'count': len(payload),
        })

    # ---- Barcode price-checker --------------------------------------------

    def _format_value(self, product, field, sym):
        """Render one product field's value for display (type-aware)."""
        try:
            raw = product[field.name]
        except Exception:
            return None
        t = field.ttype
        if t == 'many2one':
            return raw.display_name if raw else ''
        if t in ('one2many', 'many2many'):
            return ', '.join(raw.mapped('display_name')) if raw else ''
        if t == 'boolean':
            return 'Yes' if raw else 'No'
        if t == 'monetary':
            return '%s%.2f' % (sym, raw or 0.0)
        if t == 'float':
            return '%.2f' % (raw or 0.0)
        if raw in (False, None):
            return ''
        return str(raw)

    @http.route('/signage/lookup', type='jsonrpc', auth='user', methods=['POST'])
    def signage_lookup(self, barcode=None, **kw):
        """Look up a product by barcode and return the product name/image plus
        ONLY the fields the admin picked for it — hidden fields (e.g. cost price)
        are filtered out here, never sent."""
        code = (barcode or '').strip()
        _logger.info("[signage.lookup] user=%s raw=%r stripped=%r",
                     request.env.user.login, barcode, code)
        if not code:
            _logger.info("[signage.lookup] empty barcode → not found")
            return {'found': False}

        Product = request.env['product.product'].sudo()
        product = Product.search([('barcode', '=', code)], limit=1)
        if not product:
            tmpl = request.env['product.template'].sudo().search(
                [('barcode', '=', code)], limit=1)
            product = tmpl.product_variant_id if tmpl else product
        if not product:
            # Diagnostic: does *any* product carry this barcode (variant/template)?
            any_v = Product.search_count([('barcode', '=', code)])
            any_t = request.env['product.template'].sudo().search_count(
                [('barcode', '=', code)])
            _logger.info("[signage.lookup] NO product for %r "
                         "(variant matches=%s, template matches=%s) → not found",
                         code, any_v, any_t)
            return {'found': False}

        tmpl = product.product_tmpl_id
        # Master per-product switch: off → not shown on scan at all.
        if not tmpl.signage_enabled:
            _logger.info("[signage.lookup] product %s %r has 'Show on scan' OFF "
                         "(signage_enabled=False) → not found",
                         product.id, product.display_name)
            return {'found': False}
        _logger.info("[signage.lookup] FOUND product %s %r (barcode=%r)",
                     product.id, product.display_name, product.barcode)

        sym = product.currency_id.symbol or ''
        cfg = request.env['signage.config'].sudo().get_singleton()
        res = {'found': True, 'name': product.display_name,
               'detail_seconds': cfg.detail_seconds or 8}
        if tmpl.signage_show_image and product.image_512:
            res['image'] = image_data_uri(product.image_512)

        rows = []
        # Global mode: the same admin-picked fields for every product. Otherwise
        # each product uses its own configured field list. (The per-product
        # 'Show on scan' gate above still applies in both modes.)
        if cfg.global_fields_mode:
            cfg._ensure_global_lines()
            lines = cfg.global_field_ids.filtered('show')
        else:
            lines = tmpl.signage_field_line_ids.filtered('show')
        if lines:
            for line in lines:
                val = self._format_value(product, line.field_id, sym)
                if val is None:
                    continue
                rows.append({'label': line.field_id.field_description, 'value': val})
        else:
            # Nothing configured yet → a sensible default: the sales price.
            rows.append({'label': 'Price', 'value': '%s%.2f' % (sym, product.list_price)})
        res['rows'] = rows
        return res

    # ---- App-side management (managers only) ------------------------------

    def _is_manager(self):
        """True when the signed-in user may manage signage (create rights)."""
        return request.env['signage.banner'].has_access('create')

    @http.route('/signage/can_manage', type='jsonrpc', auth='user', methods=['POST'])
    def signage_can_manage(self, **kw):
        return self._is_manager()

    @http.route('/signage/stats', type='jsonrpc', auth='user', methods=['POST'])
    def signage_stats(self, **kw):
        """Dashboard counts for the app's Manage overview."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        Banner = request.env['signage.banner'].sudo().with_context(active_test=False)
        all_b = Banner.search([])
        live = request.env['signage.banner'].sudo().search(self._live_domain())
        videos = len(all_b.filtered(lambda b: b.media_type == 'video'))
        Tmpl = request.env['product.template'].sudo()
        return {
            'banners_total': len(all_b),
            'banners_live': len(live),
            'banners_video': videos,
            'banners_image': len(all_b) - videos,
            'products_total': Tmpl.search_count([]),
            'products_on_scan': Tmpl.search_count([('signage_enabled', '=', True)]),
        }

    @http.route('/signage/detail/get', type='jsonrpc', auth='user', methods=['POST'])
    def signage_detail_get(self, **kw):
        """The shared 'detail display time' setting (value + unit + seconds)."""
        cfg = request.env['signage.config'].sudo().get_singleton()
        return {'value': cfg.detail_value, 'unit': cfg.detail_unit,
                'seconds': cfg.detail_seconds or 8}

    @http.route('/signage/detail/set', type='jsonrpc', auth='user', methods=['POST'])
    def signage_detail_set(self, value=None, unit=None, **kw):
        if not self._is_manager():
            return {'error': 'Not allowed'}
        cfg = request.env['signage.config'].sudo().get_singleton()
        vals = {}
        if value not in (None, ''):
            vals['detail_value'] = max(1, int(value))
        if unit in ('sec', 'min'):
            vals['detail_unit'] = unit
        if vals:
            cfg.write(vals)
        return {'ok': True, 'value': cfg.detail_value, 'unit': cfg.detail_unit,
                'seconds': cfg.detail_seconds or 8}

    @http.route('/signage/global_fields/get', type='jsonrpc', auth='user', methods=['POST'])
    def signage_global_fields_get(self, **kw):
        """Global scan-fields config for the app: the master mode plus the shared
        field list (used for every product when the mode is on). Same `fields`
        shape as /signage/product/get."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        cfg = request.env['signage.config'].sudo().get_singleton()
        cfg._ensure_global_lines()
        return {
            'mode': cfg.global_fields_mode,
            'fields': [{
                'line_id': line.id,
                'field_id': line.field_id.id,
                'name': line.field_id.name,
                'label': line.field_id.field_description,
                'show': line.show,
            } for line in cfg.global_field_ids],
        }

    @http.route('/signage/global_fields/set', type='jsonrpc', auth='user', methods=['POST'])
    def signage_global_fields_set(self, mode=None, fields=None, **kw):
        """Save the global mode and (optionally) the shared field list. Passing
        only `mode` flips the toggle without touching the list; passing `fields`
        reconciles the list the same way /signage/product/save does."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        cfg = request.env['signage.config'].sudo().get_singleton()
        if mode is not None:
            cfg.global_fields_mode = bool(mode)
        if fields is not None:
            Line = request.env['signage.config.field'].sudo()
            existing = {l.field_id.id: l for l in cfg.global_field_ids}
            keep, seq = set(), 10
            for item in fields:
                fid = int(item.get('field_id'))
                show = bool(item.get('show'))
                keep.add(fid)
                if fid in existing:
                    existing[fid].write({'show': show, 'sequence': seq})
                else:
                    Line.create({'config_id': cfg.id, 'field_id': fid,
                                 'show': show, 'sequence': seq})
                seq += 10
            drop = cfg.global_field_ids.filtered(lambda l: l.field_id.id not in keep)
            if drop:
                drop.unlink()
        return {'ok': True}

    @http.route('/signage/banners/manage', type='jsonrpc', auth='user', methods=['POST'])
    def signage_banners_manage(self, **kw):
        """All banners (incl. archived) as cards for the app's manage screen."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        banners = request.env['signage.banner'].sudo().with_context(
            active_test=False).search([])
        return {'banners': [{
            'id': b.id,
            'name': b.name,
            'media_type': b.media_type,
            # App on/off toggle = show_on_display (a plain on/off, not archiving).
            'active': b.show_on_display,
            'is_live': b.is_live,
            'thumb': image_data_uri(b.image) if b.image else False,
            'has_video': bool(b.media_type == 'video' and b.video),
            'video': ('/signage/video_admin/%s' % b.id)
                     if (b.media_type == 'video' and b.video) else False,
        } for b in banners]}

    @http.route('/signage/fields', type='jsonrpc', auth='user', methods=['POST'])
    def signage_fields(self, **kw):
        """Every product field that can be shown on scan — for the app's field
        picker (mirrors the module's 'Add a line' field list)."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        displayable = ['char', 'text', 'html', 'float', 'monetary', 'integer',
                       'boolean', 'many2one', 'selection', 'date', 'datetime']
        fields = request.env['ir.model.fields'].sudo().search([
            ('model', '=', 'product.template'),
            ('ttype', 'in', displayable),
            ('name', 'not in', ['name', 'display_name']),
        ], order='field_description')
        return {'fields': [{
            'field_id': f.id,
            'name': f.name,
            'label': f.field_description,
            'ttype': f.ttype,
        } for f in fields]}

    @http.route('/signage/banner/get', type='jsonrpc', auth='user', methods=['POST'])
    def signage_banner_get(self, banner_id=None, **kw):
        """Full field set for one banner, to pre-fill the app's edit form."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        b = request.env['signage.banner'].sudo().with_context(
            active_test=False).browse(int(banner_id or 0))
        if not b.exists():
            return {'error': 'Banner not found'}
        return {
            'id': b.id,
            'name': b.name,
            'media_type': b.media_type,
            'image': image_data_uri(b.image) if b.image else False,
            'has_video': bool(b.video),
            'video': ('/signage/video_admin/%s' % b.id) if b.video else False,
            'video_filename': b.video_filename or '',
            'duration_mode': b.duration_mode,
            'scroll_seconds': b.scroll_seconds,
            'sequence': b.sequence,
            # App on/off toggle = show_on_display (a plain on/off, not archiving).
            'active': b.show_on_display,
            'date_start': str(b.date_start) if b.date_start else '',
            'date_end': str(b.date_end) if b.date_end else '',
        }

    @http.route('/signage/banner/save', type='jsonrpc', auth='user', methods=['POST'])
    def signage_banner_save(self, banner_id=None, name=None, media_type='image',
                            image=None, video=None, video_filename=None,
                            duration_mode='auto', scroll_seconds=None, sequence=None,
                            active=True, date_start=None, date_end=None, **kw):
        """Create (no banner_id) or update a banner from the app. Media is only
        written when new base64 is sent."""
        if not self._is_manager():
            return {'error': 'Not allowed'}

        def strip(d):
            return d.split(',', 1)[1] if isinstance(d, str) and d.startswith('data:') else d

        Banner = request.env['signage.banner'].sudo()
        editing = bool(banner_id)
        b = Banner.with_context(active_test=False).browse(int(banner_id)) if editing else None
        if editing and (not b or not b.exists()):
            return {'error': 'Banner not found'}

        vals = {}
        if name is not None:
            if not name.strip():
                return {'error': 'Please provide a banner name.'}
            vals['name'] = name.strip()
        if media_type:
            vals['media_type'] = media_type
        if duration_mode:
            vals['duration_mode'] = duration_mode
        if active is not None:
            # The app's on/off toggle drives show_on_display, not the archive flag,
            # so turning a banner off just hides it from the display (kept in list).
            vals['show_on_display'] = bool(active)

        if media_type == 'video':
            if video:
                vals['video'] = strip(video)
                if video_filename:
                    vals['video_filename'] = video_filename
            elif not editing:
                return {'error': 'Please upload a video (Media Type is Video).'}
            if image:
                vals['image'] = strip(image)  # optional poster
        else:
            if image:
                vals['image'] = strip(image)
            elif not editing:
                return {'error': 'Please upload an image (Media Type is Image).'}

        if duration_mode == 'custom' and scroll_seconds not in (None, ''):
            vals['scroll_seconds'] = int(scroll_seconds)
        if sequence not in (None, ''):
            vals['sequence'] = int(sequence)
        vals['date_start'] = date_start or False
        vals['date_end'] = date_end or False

        try:
            if editing:
                b.write(vals)
            else:
                if not vals.get('name'):
                    return {'error': 'Please provide a banner name.'}
                b = Banner.create(vals)
        except (ValidationError, UserError) as exc:
            return {'error': exc.args[0] if exc.args else 'Could not save the banner.'}
        return {'id': b.id, 'name': b.name}

    @http.route('/signage/products', type='jsonrpc', auth='user', methods=['POST'])
    def signage_products(self, query='', limit=100, **kw):
        """Product list with the master on/off state — the app's Scan Fields list."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        domain = []
        q = (query or '').strip()
        if q:
            domain = ['|', ('name', 'ilike', q), ('barcode', 'ilike', q)]
        products = request.env['product.template'].sudo().search(
            domain, limit=min(int(limit or 100), 300), order='name')
        return {'products': [{
            'id': p.id,
            'name': p.display_name,
            'barcode': p.barcode or '',
            'signage_enabled': p.signage_enabled,
            'thumb': image_data_uri(p.image_128) if p.image_128 else False,
        } for p in products]}

    @http.route('/signage/product/toggle', type='jsonrpc', auth='user', methods=['POST'])
    def signage_product_toggle(self, tmpl_id=None, enabled=None, **kw):
        """Quick master on/off from the Scan Fields list."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        p = request.env['product.template'].sudo().browse(int(tmpl_id)) if tmpl_id else None
        if not p or not p.exists():
            return {'error': 'Product not found'}
        p.signage_enabled = bool(enabled)
        return {'ok': True, 'signage_enabled': p.signage_enabled}

    @http.route('/signage/product/get', type='jsonrpc', auth='user', methods=['POST'])
    def signage_product_get(self, tmpl_id=None, **kw):
        """One product's full scan config: master on/off, show-image, and each
        field with its own show toggle (the same options as the module form)."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        p = request.env['product.template'].sudo().browse(int(tmpl_id)) if tmpl_id else None
        if not p or not p.exists():
            return {'error': 'Product not found'}
        # Products created before install have no lines yet — populate the curated
        # defaults on first open so the config always has the standard fields.
        if not p.signage_field_line_ids:
            p.signage_field_line_ids = p._signage_default_lines()
        return {
            'id': p.id,
            'name': p.display_name,
            'barcode': p.barcode or '',
            'image': image_data_uri(p.image_256) if p.image_256 else False,
            'signage_enabled': p.signage_enabled,
            'signage_show_image': p.signage_show_image,
            'fields': [{
                'line_id': line.id,
                'field_id': line.field_id.id,
                'name': line.field_id.name,
                'label': line.field_id.field_description,
                'show': line.show,
            } for line in p.signage_field_line_ids],
        }

    @http.route('/signage/product/save', type='jsonrpc', auth='user', methods=['POST'])
    def signage_product_save(self, tmpl_id=None, signage_enabled=None,
                             signage_show_image=None, fields=None, **kw):
        """Persist the product's scan config from the app. `fields` is the full
        ordered list [{field_id, show}] — the server reconciles it against the
        existing lines (add new, drop removed, set show + order)."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        p = request.env['product.template'].sudo().browse(int(tmpl_id)) if tmpl_id else None
        if not p or not p.exists():
            return {'error': 'Product not found'}
        vals = {}
        if signage_enabled is not None:
            vals['signage_enabled'] = bool(signage_enabled)
        if signage_show_image is not None:
            vals['signage_show_image'] = bool(signage_show_image)
        if vals:
            p.write(vals)
        if fields is not None:
            Line = request.env['signage.product.field'].sudo()
            existing = {l.field_id.id: l for l in p.signage_field_line_ids}
            keep, seq = set(), 10
            for item in fields:
                fid = int(item.get('field_id'))
                show = bool(item.get('show'))
                keep.add(fid)
                if fid in existing:
                    existing[fid].write({'show': show, 'sequence': seq})
                else:
                    Line.create({'product_tmpl_id': p.id, 'field_id': fid,
                                 'show': show, 'sequence': seq})
                seq += 10
            drop = p.signage_field_line_ids.filtered(lambda l: l.field_id.id not in keep)
            if drop:
                drop.unlink()
        return {'ok': True}

    # ---- Product create / edit (Manage → Products, admins only) ------------

    @staticmethod
    def _strip_data_uri(d):
        return d.split(',', 1)[1] if isinstance(d, str) and d.startswith('data:') else d

    # Custom (manual) product fields we can edit as plain inputs in the app form.
    EDITABLE_CUSTOM_TYPES = ('char', 'text', 'float', 'monetary', 'integer', 'boolean')

    def _product_vals(self, name=None, barcode=None, list_price=None,
                      standard_price=None, categ_id=None, description_sale=None,
                      default_code=None, uom_id=None, image=None, creating=False):
        vals = {}
        if name is not None:
            if not name.strip():
                return None, 'Please enter a product name.'
            vals['name'] = name.strip()
        if barcode is not None:
            vals['barcode'] = barcode.strip() or False
        if list_price not in (None, ''):
            vals['list_price'] = float(list_price)
        if standard_price not in (None, ''):
            vals['standard_price'] = float(standard_price)
        if categ_id:
            vals['categ_id'] = int(categ_id)
        if description_sale is not None:
            vals['description_sale'] = description_sale or False
        if default_code is not None:
            vals['default_code'] = default_code.strip() or False
        if uom_id:
            vals['uom_id'] = int(uom_id)
        if image:
            vals['image_1920'] = self._strip_data_uri(image)
        return vals, None

    # All custom (manual) product.template field types the app form can edit.
    FORM_CUSTOM_TYPES = ('char', 'text', 'float', 'monetary', 'integer', 'boolean',
                         'selection', 'many2one', 'date', 'datetime')

    def _merge_custom(self, vals, custom):
        """Coerce & merge app-supplied custom-field values into `vals`."""
        if not custom:
            return
        Field = request.env['ir.model.fields'].sudo()
        for fname, fval in custom.items():
            f = Field.search([('model', '=', 'product.template'),
                              ('name', '=', fname), ('state', '=', 'manual')], limit=1)
            if not f:
                continue
            t = f.ttype
            if t == 'boolean':
                vals[fname] = bool(fval)
            elif t in ('float', 'monetary'):
                vals[fname] = float(fval or 0)
            elif t == 'integer':
                vals[fname] = int(fval or 0)
            elif t == 'many2one':
                vals[fname] = int(fval) if fval else False
            else:  # char, text, selection, date, datetime
                vals[fname] = fval or False

    def _product_custom_fields(self, p):
        """Manual (custom) editable product.template fields + current values —
        so a field added to products in Odoo auto-appears on the app form.
        Includes selection (with options), many2one (with relation) and dates."""
        Field = request.env['ir.model.fields'].sudo()
        fs = Field.search([
            ('model', '=', 'product.template'),
            ('state', '=', 'manual'),
            ('ttype', 'in', list(self.FORM_CUSTOM_TYPES)),
            ('name', 'not in', ['name', 'display_name']),
        ])
        out = []
        for f in fs:
            try:
                val = p[f.name]
            except Exception:
                continue
            t = f.ttype
            item = {'name': f.name, 'label': f.field_description, 'ttype': t}
            if t == 'boolean':
                item['value'] = bool(val)
            elif t in ('float', 'monetary'):
                item['value'] = float(val or 0)
            elif t == 'integer':
                item['value'] = int(val or 0)
            elif t == 'selection':
                item['value'] = val or ''
                item['options'] = [[s.value, s.name] for s in f.selection_ids]
            elif t == 'many2one':
                item['value'] = val.id if val else False
                item['value_label'] = val.display_name if val else ''
                item['relation'] = f.relation or ''
            elif t in ('date', 'datetime'):
                item['value'] = str(val) if val else ''
            else:  # char, text
                item['value'] = val or ''
            out.append(item)
        return out

    @http.route('/signage/product/create', type='jsonrpc', auth='user', methods=['POST'])
    def signage_product_create(self, name=None, **kw):
        """Create a product from the app (Manage → Products). Admins only."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        if not name or not name.strip():
            return {'error': 'Please enter a product name.'}
        custom = kw.pop('custom', None)
        vals, err = self._product_vals(name=name, creating=True, **kw)
        if err:
            return {'error': err}
        self._merge_custom(vals, custom)
        try:
            p = request.env['product.template'].sudo().create(vals)
        except (ValidationError, UserError) as exc:
            return {'error': exc.args[0] if exc.args else 'Could not create the product.'}
        except Exception as exc:  # noqa: BLE001 — surface a friendly message
            return {'error': str(exc) or 'Could not create the product.'}
        return {'id': p.id, 'name': p.display_name}

    @http.route('/signage/product/basic/get', type='jsonrpc', auth='user', methods=['POST'])
    def signage_product_basic_get(self, tmpl_id=None, **kw):
        """Editable product basics (name, barcode, prices, category, image)."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        p = request.env['product.template'].sudo().browse(int(tmpl_id)) if tmpl_id else None
        if not p or not p.exists():
            return {'error': 'Product not found'}
        return {
            'id': p.id,
            'name': p.name,
            'barcode': p.barcode or '',
            'list_price': p.list_price or 0.0,
            'standard_price': p.standard_price or 0.0,
            'categ_id': p.categ_id.id if p.categ_id else False,
            'categ_name': p.categ_id.complete_name if p.categ_id else '',
            'default_code': p.default_code or '',
            'uom_id': p.uom_id.id if p.uom_id else False,
            'uom_name': p.uom_id.name if p.uom_id else '',
            'description_sale': p.description_sale or '',
            'image': image_data_uri(p.image_256) if p.image_256 else False,
            'custom_fields': self._product_custom_fields(p),
        }

    @http.route('/signage/product/basic/save', type='jsonrpc', auth='user', methods=['POST'])
    def signage_product_basic_save(self, tmpl_id=None, **kw):
        """Update product basics from the app. Admins only."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        p = request.env['product.template'].sudo().browse(int(tmpl_id)) if tmpl_id else None
        if not p or not p.exists():
            return {'error': 'Product not found'}
        custom = kw.pop('custom', None)
        vals, err = self._product_vals(**kw)
        if err:
            return {'error': err}
        self._merge_custom(vals, custom)
        try:
            if vals:
                p.write(vals)
        except (ValidationError, UserError) as exc:
            return {'error': exc.args[0] if exc.args else 'Could not save the product.'}
        return {'ok': True}

    @http.route('/signage/categories', type='jsonrpc', auth='user', methods=['POST'])
    def signage_categories(self, **kw):
        """Product categories for the app's category picker. Admins only."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        cats = request.env['product.category'].sudo().search([], order='complete_name')
        return {'categories': [{'id': cat.id, 'name': cat.complete_name} for cat in cats]}

    @http.route('/signage/uoms', type='jsonrpc', auth='user', methods=['POST'])
    def signage_uoms(self, **kw):
        """Units of measure for the app's UoM picker. Admins only."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        uoms = request.env['uom.uom'].sudo().search([], order='name')
        return {'uoms': [{'id': u.id, 'name': u.name} for u in uoms]}

    @http.route('/signage/relation/search', type='jsonrpc', auth='user', methods=['POST'])
    def signage_relation_search(self, model=None, query='', limit=40, **kw):
        """Search records of a related model — for a custom many2one field picker."""
        if not self._is_manager():
            return {'error': 'Not allowed'}
        if not model or model not in request.env:
            return {'records': []}
        try:
            Model = request.env[model].sudo()
            results = Model.name_search(name=(query or '').strip(), args=[],
                                        limit=min(int(limit or 40), 80))
        except Exception:  # noqa: BLE001
            return {'records': []}
        return {'records': [{'id': r[0], 'name': r[1]} for r in results]}
