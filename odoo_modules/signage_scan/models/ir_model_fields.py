from odoo import api, models

from .signage_product import DISPLAYABLE_TYPES


class IrModelFields(models.Model):
    """Auto-sync: when a custom (manual) product field is added, add an (off)
    toggle line for it to every product's scan config — no manual step."""

    _inherit = 'ir.model.fields'

    @api.model_create_multi
    def create(self, vals_list):
        recs = super().create(vals_list)
        new = recs.filtered(
            lambda f: f.model == 'product.template'
            and f.state == 'manual'
            and f.ttype in DISPLAYABLE_TYPES
            and f.name not in ('name', 'display_name'))
        if new:
            products = self.env['product.template'].sudo().search([])
            lines = [
                {'product_tmpl_id': p.id, 'field_id': f.id, 'show': False, 'sequence': 100}
                for f in new for p in products
            ]
            if lines:
                self.env['signage.product.field'].sudo().create(lines)
        return recs
