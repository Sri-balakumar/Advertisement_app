import logging

from werkzeug.security import check_password_hash, generate_password_hash

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

# Exactly four digits — the terminal's keypad auto-submits on the fourth, so a
# PIN of any other length could not be entered there.
PIN_LEN = 4
AUTO_LOCK_MIN = 5


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

    # ---- Manage PIN lock --------------------------------------------------
    # The terminals run as an admin user, so the app's own canManage gate hides
    # nothing from whoever is holding the device. This PIN sits in front of the
    # app's Manage screens — admins included, which is the point.
    #
    # Both fields carry groups='base.group_system': ir.model.access.csv grants
    # base.group_user READ on signage.config, so without that any internal user
    # could read the PIN straight off the record.
    pin_mode = fields.Selection(
        [('off', 'No PIN'),
         ('all', 'Whole Manage section'),
         ('custom', 'Selected options only')],
        string='Ask for a PIN', default='off', required=True,
        groups='base.group_system',
        help="Off — Manage opens normally. Whole Manage section — one PIN in front "
             "of everything. Selected options only — pick which ones below.")
    manage_pin_hash = fields.Char(
        string='Manage PIN hash', copy=False, groups='base.group_system')
    manage_pin = fields.Char(
        string='Manage PIN', store=False, groups='base.group_system',
        size=PIN_LEN,
        compute='_compute_manage_pin', inverse='_inverse_manage_pin',
        help="Exactly %s digits. Numbers only — the terminal enters it on a "
             "numeric keypad." % PIN_LEN)
    pin_is_set = fields.Boolean(
        string='PIN is set', compute='_compute_pin_is_set',
        groups='base.group_system')
    auto_lock_seconds = fields.Integer(
        string='Auto-lock after', default=10, groups='base.group_system',
        help="Seconds of no tapping before Manage locks itself again on the "
             "terminal. Every tap restarts the countdown, so it never interrupts "
             "someone in the middle of editing.")

    lock_products = fields.Boolean(string='Lock Products', groups='base.group_system')
    lock_banners = fields.Boolean(string='Lock Banners', groups='base.group_system')
    lock_scan_fields = fields.Boolean(string='Lock Scan Fields', groups='base.group_system')
    lock_scan_settings = fields.Boolean(
        string='Lock Scanner & Display', groups='base.group_system',
        help="Also locks the Scan mode shortcut on the app's Profile screen — "
             "otherwise the lock is bypassed by going that way round. Shop staff "
             "then need the PIN to switch between USB scanner and camera.")
    lock_scan_history = fields.Boolean(string='Lock Scan History', groups='base.group_system')

    def _compute_manage_pin(self):
        """Always blank. The entry box must never render the stored value — and
        there is nothing to render anyway, only the hash is kept."""
        for rec in self:
            rec.manage_pin = ''

    def _inverse_manage_pin(self):
        for rec in self:
            pin = (rec.manage_pin or '').strip()
            if not pin:
                continue
            # Digits only: the terminal enters the PIN on a numeric keypad, so
            # letters or symbols would set a PIN nobody could type.
            if not pin.isdigit():
                raise ValidationError(_(
                    "The PIN must be numbers only — no letters or symbols."))
            if len(pin) != PIN_LEN:
                raise ValidationError(_(
                    "The PIN must be exactly %s digits.", PIN_LEN))
            rec.manage_pin_hash = generate_password_hash(pin)

    @api.onchange('manage_pin')
    def _onchange_manage_pin(self):
        """Flag a bad PIN as soon as the field is left, rather than only on save.

        Per-keystroke checking would need a custom JS widget and this module
        ships no asset bundle; between size=PIN_LEN (the browser refuses a fifth
        character) and this, a wrong PIN is caught before saving.
        """
        raw = self.manage_pin or ''
        if not raw:
            return
        digits = ''.join(ch for ch in raw if ch.isdigit())
        if digits != raw:
            self.manage_pin = digits
            return {'warning': {
                'title': _("Numbers only"),
                'message': _("The PIN can only contain digits — anything else was "
                             "removed. It is entered on a numeric keypad on the "
                             "terminal."),
            }}
        if len(digits) != PIN_LEN:
            return {'warning': {
                'title': _("PIN too short"),
                'message': _("The PIN must be exactly %(n)s digits — you have "
                             "%(have)s.", n=PIN_LEN, have=len(digits)),
            }}

    @api.constrains('auto_lock_seconds')
    def _check_auto_lock_seconds(self):
        for rec in self:
            if rec.auto_lock_seconds and rec.auto_lock_seconds < AUTO_LOCK_MIN:
                raise ValidationError(_(
                    "Auto-lock must be at least %s seconds, otherwise Manage "
                    "locks faster than anyone can use it.", AUTO_LOCK_MIN))

    @api.depends('manage_pin_hash')
    def _compute_pin_is_set(self):
        for rec in self:
            rec.pin_is_set = bool(rec.manage_pin_hash)

    def action_clear_manage_pin(self):
        """Remove the PIN entirely — every section opens freely again, whatever
        pin_mode says."""
        self.ensure_one()
        self.manage_pin_hash = False
        return True

    def _check_manage_pin(self, pin):
        """True when `pin` matches the stored hash. False when no PIN is set, so
        an unset PIN never accidentally authorises anything."""
        self.ensure_one()
        if not self.manage_pin_hash:
            return False
        try:
            return check_password_hash(self.manage_pin_hash, (pin or '').strip())
        except Exception:  # malformed/legacy hash must not raise at the route
            _logger.exception("[signage.lock] could not check the manage PIN")
            return False

    def _locked_sections(self):
        """Which app sections need the PIN right now. Empty when the lock is off
        or no PIN has been set — a mode with no PIN must not lock anyone out."""
        self.ensure_one()
        blank = {'manage': False, 'products': False, 'banners': False,
                 'scan_fields': False, 'scan_settings': False, 'scan_history': False}
        if not self.manage_pin_hash or self.pin_mode == 'off':
            return blank
        if self.pin_mode == 'all':
            # Everything, not just the hub: the sub-screens are reachable
            # directly, so locking only the hub would be walked around.
            return {k: True for k in blank}
        return dict(
            blank,
            products=self.lock_products,
            banners=self.lock_banners,
            scan_fields=self.lock_scan_fields,
            scan_settings=self.lock_scan_settings,
            scan_history=self.lock_scan_history,
        )

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
