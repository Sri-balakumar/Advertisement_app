from odoo import fields, models


class AppBannerImage(models.Model):
    _name = 'app.banner.image'
    _description = 'App Banner Gallery Image'
    # image.mixin (from base) provides image_1920 + the stored resized
    # variants (image_1024/512/256/128), same pattern as product.image.
    _inherit = ['image.mixin']
    _order = 'sequence, id'

    name = fields.Char(string='Name')
    sequence = fields.Integer(default=10)
    banner_id = fields.Many2one(
        'app.banner', string='Banner', ondelete='cascade', index=True)

    # Redeclare so the gallery photo is mandatory (the mixin leaves it
    # optional). image_data_uri(image_512) feeds the public carousel.
    image_1920 = fields.Image(required=True)
