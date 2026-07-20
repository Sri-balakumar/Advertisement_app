{
    'name': 'App Banner',
    'version': '19.0.6.0.0',
    'category': 'Tools',
    'summary': 'Manage Home-screen carousel banners for the mobile app',
    'description': """
App Banner
==========
Backend admin for the mobile app's Home banner carousel.

Banners are rendered at a fixed **3:1** aspect ratio in the app, matching
the upload-time crop. Use the kanban view for at-a-glance preview, the
form view to upload / replace the image, and the Archive button to hide a
banner without deleting it.
    """,
    'depends': ['base', 'mail', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'views/app_banner_views.xml',
        'views/app_banner_scan_views.xml',
        'views/app_banner_enquiry_views.xml',
        'views/banner_landing_templates.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
