import uuid


def migrate(cr, version):
    """Give every existing ad a distinct access_code before the ORM adds the
    unique/NOT NULL constraint.

    The field's lambda default would fill every existing row with the SAME uuid
    (defaults are computed once, not per row), which would break the unique
    constraint. So we create the column here (pre-schema-sync) and backfill
    distinct values. Only access_code needs this — qr_source / duration_mode
    have plain static defaults that Odoo fills safely on its own. Currently there
    are no rows, so this is a safe no-op that also stays correct if data exists.
    """
    cr.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ad_banner' AND column_name = 'access_code'
    """)
    if not cr.fetchone():
        cr.execute("ALTER TABLE ad_banner ADD COLUMN access_code varchar")

    cr.execute("SELECT id FROM ad_banner WHERE access_code IS NULL")
    for (rec_id,) in cr.fetchall():
        cr.execute("UPDATE ad_banner SET access_code = %s WHERE id = %s",
                   (uuid.uuid4().hex, rec_id))
