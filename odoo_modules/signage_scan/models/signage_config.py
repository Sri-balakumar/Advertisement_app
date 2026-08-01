from odoo import api, fields, models


class SignageConfig(models.Model):
    """Singleton settings for the signage/price-checker (one record)."""

    _name = 'signage.config'
    _description = 'Signage Settings'

    name = fields.Char(default='Signage Settings', readonly=True)
    detail_value = fields.Integer(
        string='Detail display time', default=8,
        help="How long a scanned product's details stay on screen before the "
             "banners come back.")
    detail_unit = fields.Selection(
        [('sec', 'Seconds'), ('min', 'Minutes')],
        string='Unit', default='sec', required=True)
    detail_seconds = fields.Integer(
        string='= seconds', compute='_compute_detail_seconds')

    # Global scan-fields mode: when on, every scanned product shows the same
    # fields chosen below (global_field_ids) instead of its own per-product list.
    global_fields_mode = fields.Boolean(
        string='Same fields for all products', default=False,
        help="When on, every scanned product shows the same fields chosen below, "
             "instead of each product's own scan-fields list.")
    global_field_ids = fields.One2many(
        'signage.config.field', 'config_id', string='Global scan fields')

    @api.depends('detail_value', 'detail_unit')
    def _compute_detail_seconds(self):
        for rec in self:
            v = rec.detail_value or 0
            rec.detail_seconds = v * 60 if rec.detail_unit == 'min' else v

    def _default_global_field_commands(self):
        """Curated default global fields as One2many create commands. Mirrors
        product.template's _signage_default_lines (curated general-info fields
        only) — the single source of truth for the global defaults."""
        from .signage_product import SIGNAGE_DEFAULT_FIELDS
        Field = self.env['ir.model.fields']
        cmds, seq, seen = [], 10, set()
        for name, show in SIGNAGE_DEFAULT_FIELDS:
            f = Field.search(
                [('model', '=', 'product.template'), ('name', '=', name)], limit=1)
            if f and f.id not in seen:
                cmds.append((0, 0, {'field_id': f.id, 'show': show, 'sequence': seq}))
                seq += 10
                seen.add(f.id)
        return cmds

    def _ensure_global_lines(self):
        """Seed the global field list from the curated defaults the first time it
        is used (API / scan lookup path), so global mode is never empty."""
        self.ensure_one()
        if self.global_field_ids:
            return
        cmds = self._default_global_field_commands()
        if cmds:
            self.global_field_ids = cmds

    @api.onchange('global_fields_mode')
    def _onchange_global_fields_mode(self):
        """When the admin turns the mode on in the Same Fields for All form and no fields are
        chosen yet, pre-fill the curated defaults so the list is never empty on
        first use. The empty-guard means a previously-saved list is preserved:
        turning off then on again keeps what was saved."""
        if self.global_fields_mode and not self.global_field_ids:
            self.global_field_ids = self._default_global_field_commands()

    @api.model
    def get_singleton(self):
        rec = self.env.ref('signage_scan.default_config', raise_if_not_found=False)
        if not rec:
            rec = self.search([], limit=1)
        if not rec:
            rec = self.create({})
        return rec
