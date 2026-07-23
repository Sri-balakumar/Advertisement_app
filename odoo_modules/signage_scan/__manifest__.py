{
    'name': 'Signage Scan',
    'version': '19.0.1.0.0',
    'author': 'Alphalize',
    'category': 'Marketing',
    'summary': 'Full-screen signage banners + in-store barcode price-checker',
    'description': """
Signage Scan
============
A full-screen scrolling banner display (image or video, auto/custom seconds)
that doubles as an in-store **price-checker**: scan a product barcode (phone
camera or a USB scanner on a TV) and see its details.

An admin chooses **which product fields are shown** (cost price is off by
default). The detail is filtered server-side, so hidden fields never leave Odoo.

Separate from the Ad Carousel module.
    """,
    'depends': ['base', 'web', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'views/signage_banner_views.xml',
        'views/signage_config_views.xml',
        'views/signage_product_views.xml',
        'views/signage_preview_templates.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
