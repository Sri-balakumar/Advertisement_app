def migrate(cr, version):
    """Backfill link_type for banners created before the on-scan-destination feature.

    link_type is required with default 'product', but the default only fires for
    new records — pre-existing rows have NULL. Set them to 'product' so they keep
    today's behavior (render the product landing page) and show a proper value in
    the form. The controller also treats NULL as 'product' defensively.
    """
    cr.execute("UPDATE app_banner SET link_type = 'product' WHERE link_type IS NULL")
