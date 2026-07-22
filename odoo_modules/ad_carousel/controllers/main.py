import json
import re
import urllib.parse
from datetime import timedelta

from odoo import fields, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request
from odoo.tools.image import image_data_uri


class AdCarouselController(http.Controller):

    def _live_domain(self):
        """Active ads that are within their scheduled date window."""
        today = fields.Date.context_today(request.env['ad.banner'].sudo())
        return [
            ('active', '=', True),
            '|', ('date_start', '=', False), ('date_start', '<=', today),
            '|', ('date_end', '=', False), ('date_end', '>=', today),
        ]

    @staticmethod
    def _is_office_doc(filename):
        """Office formats a browser can't render inline (need a viewer)."""
        name = (filename or '').lower()
        return name.endswith((
            '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.odt', '.ods', '.odp',
        ))

    def _log_scan(self, ad):
        """Record one scan for an ad (sudo — no public ACL on the log model)."""
        r = request.httprequest
        geo = request.geoip
        request.env['ad.banner.scan'].sudo().create({
            'banner_id': ad.id,
            'ip_address': r.remote_addr,
            'user_agent': r.user_agent.string if r.user_agent else False,
            'referrer': r.referrer or False,
            'country_code': geo.country_code or False,
            'country_name': geo.country_name or False,
        })

    def _ad_payload(self, ad):
        """Serialize one ad for the app / preview (self-contained data URIs)."""
        return {
            'id': ad.id,
            'name': ad.name,
            'has_qr': ad.has_qr,
            'qr_source': ad.qr_source,
            'link_url': ad.link_url or False,
            'image': image_data_uri(ad.image) if ad.image else False,
            # QR only exists for ads whose image has no baked-in QR.
            'qr': image_data_uri(ad.qr_image) if ad.qr_image else False,
            # False = Auto → the app uses its own default interval.
            'scroll_seconds': ad.scroll_seconds if ad.duration_mode == 'custom' else False,
            'media_type': ad.media_type,
            'video': ad._video_url() if ad.media_type == 'video' and ad.video else False,
            'landing_url': (
                ad._landing_url() if ad.qr_source == 'product' and ad.product_id else False
            ),
        }

    @http.route('/ad/carousel', type='jsonrpc', auth='user', methods=['POST'])
    def ad_carousel(self, **kw):
        """Return the live carousel ads for the mobile app.

        auth='user' → the request rides the app's logged-in session, so the
        database + user are resolved from the session cookie.

        Images and QR codes are returned as self-contained data: URIs so the app
        can render them directly with no extra image-auth round-trips.
        """
        ads = request.env['ad.banner'].sudo().search(self._live_domain())
        return [self._ad_payload(ad) for ad in ads]

    @http.route('/ad/preview', type='http', auth='user', methods=['GET'])
    def ad_preview(self, **kw):
        """In-Odoo live preview of the carousel (phone-frame).

        Same live ads and serialization as /ad/carousel, embedded in the page so
        an admin can see the loop exactly as the app shows it — no phone needed.
        """
        ads = request.env['ad.banner'].sudo().search(self._live_domain())
        payload = [self._ad_payload(ad) for ad in ads]
        return request.render('ad_carousel.ad_preview_page', {
            'ads_json': json.dumps(payload),
            'ad_count': len(payload),
        })

    @http.route('/ad/can_manage', type='jsonrpc', auth='user', methods=['POST'])
    def ad_can_manage(self, **kw):
        """True when the signed-in user may create ads (admins/managers)."""
        return request.env['ad.banner'].has_access('create')

    # ---- App settings (Profile: Address / About / Help & Support) ----------

    def _settings_payload(self, s):
        """Serialize the app-settings singleton for the mobile Profile screen."""
        return {
            'address': s.address or '',
            'about_title': s.about_title or '',
            'about_body': s.about_body or '',
            'phone': s.support_phone or '',
            'emails': [
                {'label': c.label or '', 'email': c.email or ''}
                for c in s.contact_ids
            ],
        }

    @http.route('/ad/settings', type='jsonrpc', auth='user', methods=['POST'])
    def ad_settings(self, **kw):
        """App settings (address / about / contact emails) shown in Profile.

        Any logged-in user may read; the singleton is created (with the seeded
        Alphalize defaults) on first use via sudo."""
        s = request.env['ad.app.settings'].sudo()._get_singleton()
        return self._settings_payload(s)

    @http.route('/ad/settings/save', type='jsonrpc', auth='user', methods=['POST'])
    def ad_settings_save(self, address=None, about_title=None, about_body=None,
                         phone=None, emails=None, **kw):
        """Save the app settings. Runs with the user's own rights (no sudo), so
        ir.model.access enforces admin-only editing — a non-manager gets a
        friendly error, not a write."""
        # Make sure the row exists (sudo create on a fresh DB), then re-fetch it
        # as the current user so the write below is access-checked.
        request.env['ad.app.settings'].sudo()._get_singleton()
        s = request.env['ad.app.settings'].search([], limit=1)
        if not s:
            return {'error': 'Settings are not available.'}

        vals = {}
        if address is not None:
            vals['address'] = address
        if about_title is not None:
            vals['about_title'] = about_title
        if about_body is not None:
            vals['about_body'] = about_body
        if phone is not None:
            vals['support_phone'] = phone
        if emails is not None:
            # Replace the whole contact list: clear (5) then re-create (0) in the
            # order received. Blank rows (no label and no email) are dropped.
            cmds = [(5, 0, 0)]
            for i, e in enumerate(emails or []):
                label = (e.get('label') or '').strip()
                mail = (e.get('email') or '').strip()
                if not label and not mail:
                    continue
                cmds.append((0, 0, {
                    'label': label or 'Contact',
                    'email': mail,
                    'sequence': (i + 1) * 10,
                }))
            vals['contact_ids'] = cmds

        try:
            s.write(vals)
        except AccessError:
            return {'error': 'You do not have permission to edit these settings.'}
        except (ValidationError, UserError) as exc:
            return {'error': exc.args[0] if exc.args else 'Could not save.'}
        return {'ok': True}

    # ---- Scan analytics (admin-only Insights dashboard) --------------------

    @http.route('/ad/analytics', type='jsonrpc', auth='user', methods=['POST'])
    def ad_analytics(self, **kw):
        """Scan analytics for the Insights dashboard. Admin/manager only —
        mirrors /ad/can_manage. Aggregates ad.banner.scan via sudo (read-only);
        buckets in Python so it works on any Odoo build and at this scale."""
        if not request.env['ad.banner'].has_access('create'):
            return {'error': 'Not allowed'}

        Scan = request.env['ad.banner.scan'].sudo()
        today = fields.Date.context_today(request.env['ad.banner'].sudo())

        def count_since(days):
            return Scan.search_count(
                [('create_date', '>=', str(today - timedelta(days=days)))])

        def count_range(from_days, to_days):
            return Scan.search_count([
                ('create_date', '>=', str(today - timedelta(days=from_days))),
                ('create_date', '<', str(today - timedelta(days=to_days))),
            ])

        # Load all scans once and bucket by ad + country in Python.
        rows = Scan.search_read([], ['banner_id', 'country_name'])
        ad_count, ad_name, ctry_count = {}, {}, {}
        for r in rows:
            b = r.get('banner_id')
            if b:
                ad_count[b[0]] = ad_count.get(b[0], 0) + 1
                ad_name[b[0]] = b[1]
            c = r.get('country_name')
            if c:
                ctry_count[c] = ctry_count.get(c, 0) + 1

        per_ad = sorted(
            [{'id': i, 'name': ad_name[i], 'count': n} for i, n in ad_count.items()],
            key=lambda x: x['count'], reverse=True)[:8]
        by_country = sorted(
            [{'name': c, 'count': n} for c, n in ctry_count.items()],
            key=lambda x: x['count'], reverse=True)[:6]

        # 14-day daily series, oldest -> newest (for the sparkline).
        by_day = []
        for i in range(13, -1, -1):
            day = today - timedelta(days=i)
            by_day.append({
                'date': str(day),
                'count': Scan.search_count([
                    ('create_date', '>=', str(day)),
                    ('create_date', '<', str(day + timedelta(days=1))),
                ]),
            })

        return {
            'total': len(rows),
            'last7': count_since(6),
            'prev7': count_range(13, 6),
            'last30': count_since(29),
            'per_ad': per_ad,
            'by_country': by_country,
            'by_day': by_day,
        }

    @http.route('/ad/enquiries', type='jsonrpc', auth='user', methods=['POST'])
    def ad_enquiries(self, **kw):
        """Enquiries (leads) for the app admin list. Admin/manager only —
        mirrors /ad/can_manage."""
        if not request.env['ad.banner'].has_access('create'):
            return {'error': 'Not allowed'}
        enqs = request.env['ad.enquiry'].sudo().search([], limit=200)
        return [{
            'id': e.id,
            'name': e.name or '',
            'phone': e.phone or '',
            'message': e.message or '',
            'ad': e.banner_id.name if e.banner_id else '',
            'product': e.product_id.name if e.product_id else '',
            'date': fields.Datetime.to_string(e.create_date) if e.create_date else '',
            'handled': e.handled,
        } for e in enqs]

    @http.route('/ad/products', type='jsonrpc', auth='user', methods=['POST'])
    def ad_products(self, query='', limit=40, **kw):
        """Product list for the app's product picker (runs with the user's own
        rights, so it only returns products the user may read)."""
        domain = [('name', 'ilike', query)] if query else []
        prods = request.env['product.template'].search(domain, limit=int(limit or 40))
        return [{
            'id': p.id,
            'name': p.name,
            'price': p.list_price,
            'currency': p.currency_id.symbol or '',
        } for p in prods]

    @http.route('/ad/create', type='jsonrpc', auth='user', methods=['POST'])
    def ad_create(self, name=None, media_type='image', image=None, video=None,
                  video_filename=None, has_qr=False, qr_source='link', link_url=None,
                  qr_file=None, qr_filename=None, product_id=None, compare_price=None,
                  cta_phone=None, duration_mode='auto', scroll_seconds=None,
                  sequence=None, active=True, date_start=None, date_end=None, **kw):
        """Create a carousel ad from the app admin panel (full field set).

        Runs with the user's own rights (no sudo), so ir.model.access enforces
        admin-only creation — a non-manager gets a friendly error, not a record.
        """
        def strip(d):
            # Binary/Image fields want bare base64 — drop a data: URI prefix.
            return d.split(',', 1)[1] if isinstance(d, str) and d.startswith('data:') else d

        if not name:
            return {'error': 'Please provide an ad name.'}

        vals = {
            'name': name,
            'media_type': media_type or 'image',
            'has_qr': bool(has_qr),
            'active': bool(active),
            'duration_mode': duration_mode or 'auto',
        }

        # --- Media: image or video ---
        if media_type == 'video':
            if not video:
                return {'error': 'Please upload a video (Media Type is Video).'}
            vals['video'] = strip(video)
            if video_filename:
                vals['video_filename'] = video_filename
            if image:
                vals['image'] = strip(image)  # optional poster
        else:
            if not image:
                return {'error': 'Please upload an image (Media Type is Image).'}
            vals['image'] = strip(image)

        # --- QR target (only when the media doesn't already carry a QR) ---
        if not has_qr:
            vals['qr_source'] = qr_source or 'link'
            if qr_source == 'link':
                vals['link_url'] = link_url or ''
            elif qr_source == 'file':
                if not qr_file:
                    return {'error': 'Please upload a file (QR Points To: File).'}
                vals['qr_file'] = strip(qr_file)
                if qr_filename:
                    vals['qr_filename'] = qr_filename
            elif qr_source == 'product':
                if not product_id:
                    return {'error': 'Please choose a product (QR Points To: Product).'}
                vals['product_id'] = int(product_id)
                if compare_price not in (None, ''):
                    vals['compare_price'] = float(compare_price)
                if cta_phone:
                    vals['cta_phone'] = cta_phone

        # --- Timing / scheduling / order ---
        if duration_mode == 'custom' and scroll_seconds:
            vals['scroll_seconds'] = int(scroll_seconds)
        if sequence not in (None, ''):
            vals['sequence'] = int(sequence)
        if date_start:
            vals['date_start'] = date_start
        if date_end:
            vals['date_end'] = date_end

        try:
            ad = request.env['ad.banner'].create(vals)
        except AccessError:
            return {'error': 'You do not have permission to add ads.'}
        except (ValidationError, UserError) as exc:
            return {'error': exc.args[0] if exc.args else 'Could not add the ad.'}
        return {'id': ad.id, 'name': ad.name}

    @http.route('/ad/list', type='jsonrpc', auth='user', methods=['POST'])
    def ad_list(self, **kw):
        """All ads (incl. archived) for the app admin dashboard/list view."""
        ads = request.env['ad.banner'].with_context(active_test=False).search(
            [], order='sequence, id')
        return [{
            'id': ad.id,
            'name': ad.name,
            'media_type': ad.media_type,
            'active': ad.active,
            'is_live': ad.is_live,
            'has_qr': ad.has_qr,
            'qr_source': ad.qr_source,
            'thumb': image_data_uri(ad.image) if ad.image else False,
        } for ad in ads]

    @http.route('/ad/detail', type='jsonrpc', auth='user', methods=['POST'])
    def ad_detail(self, ad_id=None, **kw):
        """Full field set for one ad, to pre-fill the edit form."""
        ad = request.env['ad.banner'].with_context(active_test=False).browse(int(ad_id or 0))
        if not ad.exists():
            return {'error': 'Ad not found.'}
        return {
            'id': ad.id,
            'name': ad.name,
            'media_type': ad.media_type,
            'image': image_data_uri(ad.image) if ad.image else False,
            'has_video': bool(ad.video),
            'video': ad._video_url() if ad.video else False,
            'video_filename': ad.video_filename or '',
            'has_qr': ad.has_qr,
            'qr_source': ad.qr_source,
            'link_url': ad.link_url or '',
            'has_file': bool(ad.qr_file),
            'qr_filename': ad.qr_filename or '',
            'product_id': ad.product_id.id if ad.product_id else False,
            'product_name': ad.product_id.name if ad.product_id else '',
            'compare_price': ad.compare_price or 0.0,
            'cta_phone': ad.cta_phone or '',
            'duration_mode': ad.duration_mode,
            'scroll_seconds': ad.scroll_seconds,
            'sequence': ad.sequence,
            'active': ad.active,
            'date_start': str(ad.date_start) if ad.date_start else '',
            'date_end': str(ad.date_end) if ad.date_end else '',
        }

    @http.route('/ad/update', type='jsonrpc', auth='user', methods=['POST'])
    def ad_update(self, ad_id=None, name=None, media_type=None, image=None, video=None,
                  video_filename=None, has_qr=None, qr_source=None, link_url=None,
                  qr_file=None, qr_filename=None, product_id=None, compare_price=None,
                  cta_phone=None, duration_mode=None, scroll_seconds=None, sequence=None,
                  active=None, date_start=None, date_end=None, **kw):
        """Update an existing ad. Media (image/video/file) is only replaced when
        new base64 is sent; every other field is written from what's provided."""
        def strip(d):
            return d.split(',', 1)[1] if isinstance(d, str) and d.startswith('data:') else d

        ad = request.env['ad.banner'].browse(int(ad_id or 0))
        if not ad.exists():
            return {'error': 'Ad not found.'}

        vals = {}
        if name is not None:
            vals['name'] = name
        if media_type is not None:
            vals['media_type'] = media_type
        if image:
            vals['image'] = strip(image)
        if video:
            vals['video'] = strip(video)
        if video_filename is not None:
            vals['video_filename'] = video_filename
        if has_qr is not None:
            vals['has_qr'] = bool(has_qr)
        if qr_source is not None:
            vals['qr_source'] = qr_source
        if link_url is not None:
            vals['link_url'] = link_url
        if qr_file:
            vals['qr_file'] = strip(qr_file)
        if qr_filename is not None:
            vals['qr_filename'] = qr_filename
        if product_id is not None:
            vals['product_id'] = int(product_id) if product_id else False
        if compare_price is not None:
            vals['compare_price'] = float(compare_price) if compare_price not in ('', None) else 0.0
        if cta_phone is not None:
            vals['cta_phone'] = cta_phone
        if duration_mode is not None:
            vals['duration_mode'] = duration_mode
        if scroll_seconds is not None:
            vals['scroll_seconds'] = int(scroll_seconds) if scroll_seconds else 4
        if sequence is not None:
            vals['sequence'] = int(sequence)
        if active is not None:
            vals['active'] = bool(active)
        if date_start is not None:
            vals['date_start'] = date_start or False
        if date_end is not None:
            vals['date_end'] = date_end or False

        try:
            ad.write(vals)
        except AccessError:
            return {'error': 'You do not have permission to edit ads.'}
        except (ValidationError, UserError) as exc:
            return {'error': exc.args[0] if exc.args else 'Could not save the ad.'}
        return {'id': ad.id, 'name': ad.name}

    @http.route('/ad/file/<string:access_code>', type='http', auth='public', methods=['GET'])
    def ad_file(self, access_code, **kw):
        """Serve the hosted file a scanned QR points to (shown inline).

        Resolves the ad, logs a scan, then streams the file so a phone displays
        the PDF/image in the browser. Only live ads with an uploaded file serve;
        anything else is a genuine 404. On the multi-DB server this route only
        resolves for anonymous scans once a dbfilter is configured.
        """
        ad = request.env['ad.banner'].sudo().search(
            self._live_domain() + [('access_code', '=', access_code)], limit=1)
        if not ad or not ad.qr_file:
            return request.not_found()

        # Log the scan. sudo() lets an unauthenticated visitor insert a row
        # without any public ACL exposing ad.banner.scan.
        r = request.httprequest
        geo = request.geoip
        request.env['ad.banner.scan'].sudo().create({
            'banner_id': ad.id,
            'ip_address': r.remote_addr,
            'user_agent': r.user_agent.string if r.user_agent else False,
            'referrer': r.referrer or False,
            'country_code': geo.country_code or False,
            'country_name': geo.country_name or False,
        })

        # Office docs don't render in a browser → open them through the Office
        # Online viewer. It fetches the raw file, so the raw URL must be
        # internet-public (a LAN IP / localhost won't work for the viewer).
        if self._is_office_doc(ad.qr_filename):
            raw_url = '%s/ad/file/%s/raw' % (ad.get_base_url(), ad.access_code)
            viewer = ('https://view.officeapps.live.com/op/view.aspx?src='
                      + urllib.parse.quote(raw_url, safe=''))
            return request.redirect(viewer, code=302, local=False)

        filename = ad.qr_filename or ('ad-%s' % ad.access_code)
        return request.env['ir.binary'].sudo()._get_stream_from(
            ad, 'qr_file', filename=filename, filename_field='qr_filename',
        ).get_response(as_attachment=False)

    @http.route('/ad/file/<string:access_code>/raw', type='http', auth='public', methods=['GET'])
    def ad_file_raw(self, access_code, **kw):
        """Raw file bytes for the external doc viewer to fetch (no scan log)."""
        ad = request.env['ad.banner'].sudo().search(
            self._live_domain() + [('access_code', '=', access_code)], limit=1)
        if not ad or not ad.qr_file:
            return request.not_found()
        filename = ad.qr_filename or ('ad-%s' % ad.access_code)
        return request.env['ir.binary'].sudo()._get_stream_from(
            ad, 'qr_file', filename=filename, filename_field='qr_filename',
        ).get_response(as_attachment=False)

    @http.route('/ad/p/<string:access_code>', type='http', auth='public', methods=['GET'])
    def ad_product_landing(self, access_code, **kw):
        """Live price page opened when a Product-QR is scanned.

        Shows the linked product's *live* Odoo price, so changing the price in
        Odoo updates every scan with no reprint. Logs the scan like /ad/file.
        """
        ad = request.env['ad.banner'].sudo().search(
            self._live_domain()
            + [('access_code', '=', access_code), ('qr_source', '=', 'product')],
            limit=1)
        if not ad or not ad.product_id:
            return request.not_found()

        self._log_scan(ad)

        product = ad.product_id
        image_uri = image_data_uri(product.image_512) if product.image_512 else False
        # tel: wants a leading +, wa.me wants bare digits — one field drives both.
        cta_digits = re.sub(r'\D', '', ad.cta_phone or '')
        return request.render('ad_carousel.ad_product_landing', {
            'ad': ad,
            'product': product,
            'image_uri': image_uri,
            'cta_digits': cta_digits,
            'sent': kw.get('sent'),
        })

    @http.route('/ad/enquiry/<string:access_code>', type='http', auth='public',
                methods=['POST'])
    def ad_enquiry_submit(self, access_code, **post):
        """Store a lead submitted from the product landing page, then redirect
        back with a thank-you flag. Public → the insert goes through sudo."""
        ad = request.env['ad.banner'].sudo().search(
            self._live_domain()
            + [('access_code', '=', access_code), ('qr_source', '=', 'product')],
            limit=1)
        if not ad:
            return request.not_found()

        # Honeypot: real users never fill the hidden "company" field; bots do.
        if not (post.get('company') or '').strip():
            name = (post.get('name') or '').strip()
            phone = (post.get('phone') or '').strip()
            if name and phone:
                request.env['ad.enquiry'].sudo().create({
                    'banner_id': ad.id,
                    'name': name,
                    'phone': phone,
                    'message': (post.get('message') or '').strip(),
                })
        return request.redirect('/ad/p/%s?sent=1' % access_code)

    @http.route('/ad/video/<string:access_code>', type='http', auth='public', methods=['GET'])
    def ad_video(self, access_code, **kw):
        """Stream a live ad's uploaded video inline (for the app carousel)."""
        ad = request.env['ad.banner'].sudo().search(
            self._live_domain() + [('access_code', '=', access_code)], limit=1)
        if not ad or not ad.video:
            return request.not_found()
        filename = ad.video_filename or ('ad-%s.mp4' % ad.access_code)
        return request.env['ir.binary'].sudo()._get_stream_from(
            ad, 'video', filename=filename, filename_field='video_filename',
        ).get_response(as_attachment=False)
