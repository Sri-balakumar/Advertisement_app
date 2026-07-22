from odoo import api, fields, models

# Default "About" copy shown in the app (editable by an admin afterwards).
ABOUT_DEFAULT = (
    "369 is the advertising & signage app from Alphalize — a software company "
    "that helps businesses grow with smart, custom technology.\n\n"
    "Alphalize builds ERP systems, business-intelligence dashboards, mobile & "
    "web apps, and handles integration, migration and digital marketing — on the "
    "promise \"We take your business to the next level.\"\n\n"
    "With 369, your screens do the selling. Ads — images or videos — scroll "
    "automatically, and every ad carries a QR code. A quick scan takes the "
    "customer straight to the product, its live price and the current offer. You "
    "control what plays, for how long, and where each QR leads — right from this app.\n\n"
    "Built by Alphalize · Offices in Clearwater, Florida and Kollam, Kerala · alphalize.com"
)

ADDRESS_DEFAULT = (
    "Alphalize Technology\n"
    "2nd Floor, Danat Building\n"
    "Kollam, Kerala 691014\n"
    "India"
)


class AdAppSettings(models.Model):
    """Singleton holding the app's Profile content: the company address, the
    About write-up and the Help & Support contact emails. One row per database;
    the mobile app reads it via /ad/settings and (admins only) edits it via
    /ad/settings/save."""

    _name = 'ad.app.settings'
    _description = 'Advertisement App Settings'

    name = fields.Char(default='App Settings')
    address = fields.Text(string='Address', default=ADDRESS_DEFAULT)
    about_title = fields.Char(string='About Title', default='Alphalize (369)')
    about_body = fields.Text(string='About', default=ABOUT_DEFAULT)
    support_phone = fields.Char(string='Support Phone', default='+91 70252 05503')
    contact_ids = fields.One2many(
        'ad.app.contact', 'settings_id', string='Contact Emails')

    @api.model
    def _get_singleton(self):
        """The single settings record — created (with the seeded HR/Sales
        contacts) the first time it's needed."""
        rec = self.search([], limit=1)
        if not rec:
            rec = self.create({
                'name': 'App Settings',
                'contact_ids': [
                    (0, 0, {'label': 'HR', 'email': 'hr@alphalize.com', 'sequence': 10}),
                    (0, 0, {'label': 'Sales', 'email': 'sales@alphalize.com', 'sequence': 20}),
                ],
            })
        return rec


class AdAppContact(models.Model):
    """One labelled contact email shown in Help & Support (HR, Sales, …). Any
    number can be added."""

    _name = 'ad.app.contact'
    _description = 'Advertisement App Contact Email'
    _order = 'sequence, id'

    settings_id = fields.Many2one(
        'ad.app.settings', required=True, ondelete='cascade')
    label = fields.Char(string='Label', required=True)
    email = fields.Char(string='Email')
    sequence = fields.Integer(default=10)
