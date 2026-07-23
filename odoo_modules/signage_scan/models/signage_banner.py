import uuid

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

# Accepted video containers for a Video banner (keeps audio files like .ogg out).
VIDEO_EXTS = ('.mp4', '.webm', '.mov', '.m4v', '.ogv', '.avi', '.mkv', '.3gp')


class SignageBanner(models.Model):
    """A full-screen signage banner (image or video) with its own timing."""

    _name = 'signage.banner'
    _description = 'Signage Banner'
    _order = 'sequence, id'
    _rec_name = 'name'

    name = fields.Char(
        string='Name', required=True, help="Internal label for this banner.")
    media_type = fields.Selection(
        [('image', 'Image'), ('video', 'Video')],
        string='Media Type', default='image', required=True)
    image = fields.Image(
        string='Image', max_width=1920, max_height=1920,
        help="Shown full-screen. Required for Image; optional poster for Video.")
    video = fields.Binary(string='Video', attachment=True)
    video_filename = fields.Char(string='Video File Name')
    access_code = fields.Char(
        string='Access Code', required=True, copy=False, index=True,
        default=lambda self: uuid.uuid4().hex,
        help="Stable token used in the video URL /signage/video/<code>.")
    sequence = fields.Integer(string='Sequence', default=10)
    active = fields.Boolean(string='Active', default=True)
    show_on_display = fields.Boolean(
        string='Show on display', default=True,
        help="Simple on/off for the live display. Off hides the banner from the "
             "signage now while keeping it in your list — turn it back on any time "
             "to show it again. Unlike Active (archive), the banner is not removed "
             "from your banner list.")

    duration_mode = fields.Selection(
        [('auto', 'Auto'), ('custom', 'Custom')],
        string='Time on Screen', default='auto', required=True,
        help="Auto — images use the app default; a video plays its full length "
             "then moves on. Custom — stays exactly the seconds below (a longer "
             "video is cut off at that time; it does not play faster).")
    scroll_seconds = fields.Integer(
        string='Seconds', default=6,
        help="Seconds this banner stays on screen (used when Time on Screen is Custom).")

    video_preview = fields.Html(
        string='Video Preview', compute='_compute_video_preview', sanitize=False)

    @api.depends('video', 'media_type', 'video_filename')
    def _compute_video_preview(self):
        """Inline player for the form — the file field only shows a filename.
        Embeds the uploaded bytes so it previews immediately on upload (before
        save), and reflects a replaced video right away. An audio file shows
        nothing here (no video track) — the hint to upload a real MP4/WebM."""
        for rec in self:
            if rec.media_type == 'video' and rec.video:
                fname = (rec.video_filename or '').lower()
                if fname.endswith('.webm'):
                    mimetype = 'video/webm'
                elif fname.endswith('.mov'):
                    mimetype = 'video/quicktime'
                elif fname.endswith('.m4v'):
                    mimetype = 'video/x-m4v'
                else:
                    mimetype = 'video/mp4'
                b64 = rec.video.decode() if isinstance(rec.video, bytes) else rec.video
                rec.video_preview = (
                    '<video controls preload="metadata" '
                    'style="max-width:100%%;max-height:320px;border-radius:8px;'
                    'background:#000;" src="data:%s;base64,%s"></video>'
                    % (mimetype, b64))
            else:
                rec.video_preview = False

    date_start = fields.Date(string='Start Date')
    date_end = fields.Date(string='End Date')
    is_live = fields.Boolean(
        string='Live now', compute='_compute_is_live', search='_search_is_live')

    _access_code_uniq = models.Constraint(
        'unique(access_code)', 'The banner access code must be unique.')

    def _video_url(self):
        self.ensure_one()
        return '%s/signage/video/%s' % (self.get_base_url(), self.access_code)

    @api.depends('show_on_display', 'date_start', 'date_end')
    def _compute_is_live(self):
        today = fields.Date.context_today(self)
        for rec in self:
            rec.is_live = bool(
                rec.show_on_display
                and (not rec.date_start or rec.date_start <= today)
                and (not rec.date_end or today <= rec.date_end))

    def _search_is_live(self, operator, value):
        today = fields.Date.context_today(self)
        live = [
            ('show_on_display', '=', True),
            '|', ('date_start', '=', False), ('date_start', '<=', today),
            '|', ('date_end', '=', False), ('date_end', '>=', today),
        ]
        want_live = (operator in ('=', '==')) == bool(value)
        if want_live:
            return live
        return [
            '|', ('show_on_display', '=', False),
            '|', ('date_start', '>', today), ('date_end', '<', today),
        ]

    @api.constrains('media_type', 'video', 'video_filename')
    def _check_video(self):
        for rec in self:
            if rec.media_type != 'video':
                continue
            if not rec.video:
                raise ValidationError(_(
                    "Upload a Video for “%s”, or set Media Type back to Image.",
                    rec.name or _('this banner')))
            fname = (rec.video_filename or '').lower()
            if not fname.endswith(VIDEO_EXTS):
                raise ValidationError(_(
                    "“%(file)s” is not a video file. Upload a real video such as "
                    "MP4 or WebM — audio files (e.g. a WhatsApp .ogg voice note) "
                    "are not accepted in Video mode.",
                    file=rec.video_filename or rec.name or _('the file')))

    @api.constrains('media_type', 'image')
    def _check_image(self):
        for rec in self:
            if rec.media_type == 'image' and not rec.image:
                raise ValidationError(_(
                    "Upload an Image for “%s” (Media Type is Image).",
                    rec.name or _('this banner')))
