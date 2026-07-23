from odoo import fields, models


class SignageConfigField(models.Model):
    """One product field with a show/hide toggle used when *global* scan-fields
    mode is on: the same selected fields are shown for every scanned product,
    instead of each product's own `signage.product.field` list. Mirrors the
    per-product model but hangs off the settings singleton."""

    _name = 'signage.config.field'
    _description = 'Signage Global Field'
    _order = 'sequence, id'

    config_id = fields.Many2one(
        'signage.config', string='Settings', required=True,
        ondelete='cascade', index=True)
    field_id = fields.Many2one(
        'ir.model.fields', string='Field', required=True, ondelete='cascade',
        domain="[('model_id.model', '=', 'product.template'),"
               " ('ttype', 'in', ['char','text','html','float','monetary',"
               "'integer','boolean','many2one','selection','date','datetime']),"
               " ('name', 'not in', ['name','display_name'])]")
    show = fields.Boolean(string='Show', default=True)
    sequence = fields.Integer(string='Sequence', default=10)
