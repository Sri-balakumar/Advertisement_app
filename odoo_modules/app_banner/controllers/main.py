import re

from odoo import http
from odoo.http import request
from odoo.tools.image import image_data_uri


class AppBannerController(http.Controller):

    def _get_banner(self, access_code):
        """Resolve a banner from its short code (sudo, archived included).

        active_test=False so an archived banner still resolves (and can show a
        friendly message) rather than looking like an unknown code. sudo() lets
        an unauthenticated visitor read it without any public ACL.
        """
        return request.env['app.banner'].sudo().with_context(
            active_test=False).search([('access_code', '=', access_code)], limit=1)

    @http.route(['/b/<string:access_code>'], type='http', auth='public', methods=['GET'])
    def banner_landing(self, access_code, sent=None, **kw):
        """Public landing hit by the QR / short link.

        Resolves the (dynamic) target through Odoo, logs the scan, then renders
        the linked product's detail page with the optional brochure, gallery,
        contact CTAs and an enquiry form. A banner that is archived or has no
        linked product shows a friendly "not available" holding page instead of
        a raw 404. Only a completely unknown code returns a genuine 404.
        """
        banner = self._get_banner(access_code)
        if not banner:
            return request.not_found()

        # Log the scan for any real banner. sudo() lets an unauthenticated
        # visitor insert a row without any public ACL exposing app.banner.scan.
        r = request.httprequest
        geo = request.geoip
        request.env['app.banner.scan'].sudo().create({
            'banner_id': banner.id,
            'ip_address': r.remote_addr,
            'user_agent': r.user_agent.string if r.user_agent else False,
            'referrer': r.referrer or False,
            'country_code': geo.country_code or False,
            'country_name': geo.country_name or False,
        })

        # Archived → friendly holding page, not a 404.
        if not banner.active:
            return request.render('app_banner.banner_unavailable_page', {'banner': banner})

        # Route the scan to the configured destination. The QR only ever encodes
        # /b/<code>, so this branch (and swapping the link/PDF) changes where a
        # scan lands without ever changing the printed QR. NULL == 'product'.
        link_type = banner.link_type or 'product'

        if link_type == 'url':
            if banner.target_url:
                # 302 (temporary), never 301 — a 301 would be cached forever and
                # defeat the "change the destination anytime" promise.
                return request.redirect(banner.target_url, code=302, local=False)
            return request.render('app_banner.banner_unavailable_page', {'banner': banner})

        if link_type == 'pdf':
            if banner.brochure:
                # Stream inline (as_attachment=False) so the phone displays the
                # PDF instead of downloading it.
                return request.env['ir.binary'].sudo()._get_stream_from(
                    banner, 'brochure',
                    filename=banner.brochure_filename or ('%s.pdf' % banner.access_code),
                    filename_field='brochure_filename',
                    mimetype='application/pdf',
                ).get_response(as_attachment=False)
            return request.render('app_banner.banner_unavailable_page', {'banner': banner})

        # link_type == 'product' → the rich landing page (needs a product).
        if not banner.product_id:
            return request.render('app_banner.banner_unavailable_page', {'banner': banner})

        # product_id is read off a sudo recordset, so no public product ACL is
        # needed. Inline every image as a data: URI — /web/image would 403 for
        # the public user without website_sale.
        product = banner.product_id
        image_uri = image_data_uri(product.image_512) if product.image_512 else False
        gallery = [
            image_data_uri(img.image_512)
            for img in banner.gallery_image_ids if img.image_512
        ]
        # tel: needs a leading +, wa.me wants bare digits — derive both from the
        # same digit string so a single field drives Call + WhatsApp buttons.
        cta_digits = re.sub(r'\D', '', banner.cta_phone or '')
        return request.render('app_banner.banner_landing_page', {
            'banner': banner,
            'product': product,
            'image_uri': image_uri,
            'gallery': gallery,
            'has_pdf': bool(banner.brochure),
            'cta_digits': cta_digits,
            'csrf_token': request.csrf_token(),
            'sent': sent,
        })

    @http.route(['/b/<string:access_code>/pdf'], type='http', auth='public', methods=['GET'])
    def banner_brochure(self, access_code, **kw):
        """Stream the banner's brochure PDF as a download."""
        banner = self._get_banner(access_code)
        if not banner or not banner.brochure:
            return request.not_found()
        filename = banner.brochure_filename or ('brochure-%s.pdf' % banner.access_code)
        return request.env['ir.binary'].sudo()._get_stream_from(
            banner, 'brochure',
            filename=filename,
            filename_field='brochure_filename',
            mimetype='application/pdf',
        ).get_response(as_attachment=True)

    @http.route(['/b/<string:access_code>/enquiry'], type='http', auth='public', methods=['POST'])
    def banner_enquiry(self, access_code, **post):
        """Handle an enquiry submitted from the landing page.

        CSRF is enforced by the framework (the form carries request.csrf_token()).
        A filled honeypot field or a missing name/phone is silently ignored — a
        bot never gets a confirmation, and no row is created. Valid submissions
        are created via sudo() (no public ACL on app.banner.enquiry) and redirect
        back to the landing page with a thank-you flag.
        """
        banner = self._get_banner(access_code)
        if not banner:
            return request.not_found()

        # Honeypot: a hidden decoy field only bots fill. name + phone required.
        honeypot = (post.get('company_website') or '').strip()
        name = (post.get('name') or '').strip()
        phone = (post.get('phone') or '').strip()
        if honeypot or not name or not phone:
            return request.redirect('/b/%s' % access_code)

        request.env['app.banner.enquiry'].sudo().create({
            'banner_id': banner.id,
            'name': name,
            'phone': phone,
            'message': (post.get('message') or '').strip() or False,
        })
        return request.redirect('/b/%s?sent=1' % access_code)
