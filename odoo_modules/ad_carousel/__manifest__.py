{
    'name': 'Ad Carousel',
    'version': '19.0.14.0.0',
    'author': 'Alphalize',
    'category': 'Marketing',
    'summary': 'Advertisement images with QR codes for the mobile app carousel',
    'description': """
Ad Carousel
===========
Manage the advertisement images shown in the mobile app's scrolling home
carousel.

For each ad you upload an image. Then:

* **The image already has a QR printed on it** → tick the box; the app shows
  the ad **full-screen**.
* **The image has no QR** → leave the box unticked and paste the advertiser's
  link; a **QR is generated automatically** and the app shows the image with a
  QR strip below it.

Kept deliberately simple and separate from the App Banner module.
    """,
    'depends': ['base', 'web', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'views/ad_banner_views.xml',
        'views/ad_settings_views.xml',
        'views/ad_enquiry_views.xml',
        'views/ad_landing_templates.xml',
        'views/ad_preview_templates.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
