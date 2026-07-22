from odoo import fields, models


class AdEnquiry(models.Model):
    """A lead submitted from a scanned product-ad landing page (name / phone /
    message). Public visitors insert via the /ad/enquiry controller (sudo);
    admins read them in the app (Manage → Enquiries) and the Odoo backend."""

    _name = 'ad.enquiry'
    _description = 'Advertisement Enquiry'
    _order = 'create_date desc'
    _rec_name = 'name'

    banner_id = fields.Many2one(
        'ad.banner', string='Ad', ondelete='set null', index=True)
    product_id = fields.Many2one(
        'product.template', string='Product',
        related='banner_id.product_id', store=True)
    name = fields.Char(string='Name', required=True)
    phone = fields.Char(string='Phone', required=True)
    message = fields.Text(string='Message')
    handled = fields.Boolean(string='Handled', default=False)
    # create_date (auto) is the submission time.
