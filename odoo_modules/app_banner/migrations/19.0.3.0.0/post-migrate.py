import uuid


def migrate(cr, version):
    """Backfill access_code for banners created before this feature.

    access_code is required + unique, so pre-existing rows (which have NULL)
    must be populated before the constraint can hold. The field default only
    fires for new records, hence this one-off backfill.
    """
    from odoo import api, SUPERUSER_ID
    env = api.Environment(cr, SUPERUSER_ID, {})
    banners = env['app.banner'].with_context(active_test=False).search(
        [('access_code', '=', False)])
    for banner in banners:
        banner.access_code = uuid.uuid4().hex
