from odoo import fields, models


class AppBannerEnquiry(models.Model):
    _name = 'app.banner.enquiry'
    _description = 'App Banner Enquiry'
    _order = 'create_date desc'
    _rec_name = 'name'

    banner_id = fields.Many2one(
        'app.banner', string='Banner', required=True,
        ondelete='cascade', index=True)
    # create_date / create_uid are provided automatically — the timestamp and
    # (for public submissions via sudo) the public user.
    name = fields.Char(string='Name', required=True)
    phone = fields.Char(string='Phone')
    message = fields.Text(string='Message')
