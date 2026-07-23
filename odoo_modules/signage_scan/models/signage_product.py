from odoo import api, fields, models

# Field types that make sense to show as a value on the scan detail.
DISPLAYABLE_TYPES = [
    'char', 'text', 'html', 'float', 'monetary', 'integer',
    'boolean', 'many2one', 'selection', 'date', 'datetime',
]

# General-information product fields pre-listed on the scan config, each with a
# default on/off state. Opening a product shows these one by one; custom fields
# are added automatically (see _signage_default_lines + ir.model.fields hook).
SIGNAGE_DEFAULT_FIELDS = [
    ('list_price', True),
    ('standard_price', False),
    ('categ_id', False),
    ('barcode', False),
    ('uom_id', False),
    ('description_sale', True),
    ('weight', False),
    ('volume', False),
]


class ProductTemplate(models.Model):
    """Per-product control of the barcode price-checker. A master on/off plus a
    list of the product's fields, each with its own show/hide toggle. New custom
    fields on products appear here automatically."""

    _inherit = 'product.template'

    signage_enabled = fields.Boolean(
        string='Show on scan', default=True,
        help="When off, scanning this product's barcode shows nothing.")
    signage_show_image = fields.Boolean(string='Scan: show image', default=True)
    signage_field_line_ids = fields.One2many(
        'signage.product.field', 'product_tmpl_id', string='Scan fields',
        help="The product fields shown when this product's barcode is scanned. "
             "Toggle each on/off. The name + image show by default; custom fields "
             "you add to products appear here automatically.")
    signage_global_on = fields.Boolean(
        string='Global fields mode on', compute='_compute_signage_global_on',
        help="True when 'Same fields for all products' is on — per-product fields "
             "below are ignored on scan until it's turned off.")

    @api.depends_context('uid')
    def _compute_signage_global_on(self):
        cfg = self.env['signage.config'].sudo().get_singleton()
        on = bool(cfg.global_fields_mode)
        for rec in self:
            rec.signage_global_on = on

    def _signage_default_lines(self):
        """Command list: the curated general-info fields (with their defaults)
        plus every custom (manual) product field (off)."""
        Field = self.env['ir.model.fields']
        cmds, seq, seen = [], 10, set()
        for name, show in SIGNAGE_DEFAULT_FIELDS:
            f = Field.search(
                [('model', '=', 'product.template'), ('name', '=', name)], limit=1)
            if f and f.id not in seen:
                cmds.append((0, 0, {'field_id': f.id, 'show': show, 'sequence': seq}))
                seq += 10
                seen.add(f.id)
        customs = Field.search([
            ('model', '=', 'product.template'), ('state', '=', 'manual'),
            ('ttype', 'in', DISPLAYABLE_TYPES), ('name', 'not in', ['name', 'display_name'])])
        for f in customs:
            if f.id not in seen:
                cmds.append((0, 0, {'field_id': f.id, 'show': False, 'sequence': seq}))
                seq += 10
                seen.add(f.id)
        return cmds

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records:
            if not rec.signage_field_line_ids:
                rec.signage_field_line_ids = rec._signage_default_lines()
        return records
