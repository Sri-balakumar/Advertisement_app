from odoo import _, api, fields, models


class SignageProductField(models.Model):
    """One product field with a show/hide toggle for the barcode price-checker
    detail. Belongs to a product (product.template); toggling `show` hides the
    field on scan without removing the row."""

    _name = 'signage.product.field'
    _description = 'Signage Product Field'
    _order = 'sequence, id'

    product_tmpl_id = fields.Many2one(
        'product.template', string='Product', required=True,
        ondelete='cascade', index=True)
    field_id = fields.Many2one(
        'ir.model.fields', string='Field', required=True, ondelete='cascade',
        domain="[('model_id.model', '=', 'product.template'),"
               " ('ttype', 'in', ['char','text','html','float','monetary',"
               "'integer','boolean','many2one','selection','date','datetime']),"
               " ('name', 'not in', ['name','display_name'])]")
    show = fields.Boolean(string='Show', default=True)
    sequence = fields.Integer(string='Sequence', default=10)

    @api.onchange('show', 'field_id')
    def _onchange_show_global_warning(self):
        """Warn the admin when they turn a field on (or add one) for a single
        product while the global "same fields for all products" mode is on — the
        per-product change won't show on scan until Global is turned off."""
        if not self.show:
            return
        cfg = self.env['signage.config'].sudo().get_singleton()
        if cfg.global_fields_mode:
            return {
                'warning': {
                    'title': _("Global fields are on"),
                    'message': _(
                        "“Same fields for all products” is currently ON, so every "
                        "product shows the same global fields. This field you just turned on "
                        "for this product won't appear on scan until you turn Global mode off "
                        "(Signage Scan → Settings)."
                    ),
                }
            }
