from odoo import fields, http
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

    @http.route('/ad/carousel', type='jsonrpc', auth='user', methods=['POST'])
    def ad_carousel(self, **kw):
        """Return the live carousel ads for the mobile app.

        auth='user' → the request rides the app's logged-in session, so the
        database + user are resolved from the session cookie.

        Images and QR codes are returned as self-contained data: URIs so the app
        can render them directly with no extra image-auth round-trips.
        """
        ads = request.env['ad.banner'].sudo().search(self._live_domain())
        result = []
        for ad in ads:
            result.append({
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
            })
        return result

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

        filename = ad.qr_filename or ('ad-%s' % ad.access_code)
        return request.env['ir.binary'].sudo()._get_stream_from(
            ad, 'qr_file', filename=filename, filename_field='qr_filename',
        ).get_response(as_attachment=False)
