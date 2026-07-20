from odoo import fields, models


class AppBannerScan(models.Model):
    _name = 'app.banner.scan'
    _description = 'App Banner Scan Log'
    _order = 'create_date desc'
    _rec_name = 'banner_id'

    banner_id = fields.Many2one(
        'app.banner', string='Banner', required=True,
        ondelete='cascade', index=True)
    # create_date / create_uid are provided automatically — they are the
    # scan timestamp and (for public hits) the public user.
    ip_address = fields.Char(string='IP Address', readonly=True)
    user_agent = fields.Char(string='User Agent', readonly=True)
    referrer = fields.Char(string='Referrer', readonly=True)
    country_code = fields.Char(string='Country Code', readonly=True)
    country_name = fields.Char(string='Country', readonly=True)
