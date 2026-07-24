from odoo import fields, models


class SignageScanLog(models.Model):
    """One row per barcode scan from the app. Lets an admin review recent scans
    and, crucially, spot barcodes that were scanned but matched no product
    (state='not_found') so the missing products can be added. Written via sudo()
    from the /signage/lookup controller, so a plain store (non-manager) device
    still records its scans."""

    _name = 'signage.scan.log'
    _description = 'Signage Scan Log'
    _order = 'scan_date desc, id desc'

    barcode = fields.Char(string='Barcode', required=True, index=True)
    product_id = fields.Many2one(
        'product.product', string='Product', ondelete='set null')
    # Denormalised so the label survives even if the product is later deleted.
    product_name = fields.Char(string='Product name')
    state = fields.Selection(
        [('found', 'Found'),
         ('not_found', 'Not found'),
         ('disabled', 'Off for scan')],
        string='Result', required=True, default='not_found', index=True)
    scan_date = fields.Datetime(
        string='Scanned at', default=fields.Datetime.now, index=True)
    user_id = fields.Many2one(
        'res.users', string='Scanned by', default=lambda self: self.env.user,
        ondelete='set null')
