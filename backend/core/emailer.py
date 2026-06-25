import base64
import json
import logging
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from email.mime.image import MIMEImage

logger = logging.getLogger(__name__)

_RESEND_ENDPOINT = 'https://api.resend.com/emails'
_HTTP_TIMEOUT = 10

_LOGO_PATH = Path(__file__).resolve().parent / 'email_assets' / 'bunik-logo.png'
_LOGO_CID = 'bunik-logo'

# Bunik brand palette (mirrors frontend src/app/components/bunik.tsx)
_INK = '#2B2722'
_CREAM = '#FBF7EE'
_TERRACOTTA = '#C2603F'
_HONEY = '#CE9B4E'
_BODY = '#5A5046'
_MUTED = '#94806A'


def _build_html(greeting: str, action_link: str) -> str:
    font = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    return f"""\
<!DOCTYPE html>
<html lang="vi">
<body style="margin:0;padding:0;background:transparent;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:transparent;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:520px;background:{_CREAM};border:2px solid {_INK};
                      border-radius:18px;overflow:hidden;font-family:{font};">
          <!-- Accent bar -->
          <tr><td style="height:6px;background:{_TERRACOTTA};font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 32px 8px;">
              <img src="cid:{_LOGO_CID}" width="76" height="76" alt="Bunik"
                   style="display:block;border:0;outline:none;" />
              <div style="margin-top:14px;font-size:26px;font-weight:700;letter-spacing:.5px;color:{_INK};">
                Bunik
              </div>
              <div style="margin-top:4px;font-size:13px;color:{_MUTED};">
                Tra cứu điểm chuẩn &amp; xét tuyển đại học
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:18px 36px 8px;color:{_BODY};font-size:15px;line-height:1.7;">
              <p style="margin:0 0 14px;font-size:17px;color:{_INK};font-weight:600;">{greeting}</p>
              <p style="margin:0 0 8px;">
                Cảm ơn bạn đã đăng ký tài khoản <strong style="color:{_TERRACOTTA};">Bunik</strong>.
                Chỉ còn một bước nữa thôi - vui lòng xác minh email để kích hoạt tài khoản của bạn.
              </p>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding:18px 36px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:12px;background:{_TERRACOTTA};">
                    <a href="{action_link}" target="_blank"
                       style="display:inline-block;padding:14px 36px;font-family:{font};
                              font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;
                              border-radius:12px;">
                      Xác minh email
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:14px 36px 4px;color:{_MUTED};font-size:12px;line-height:1.6;">
              Nếu nút không hoạt động, hãy sao chép và dán liên kết sau vào trình duyệt:
              <br/>
              <a href="{action_link}" target="_blank"
                 style="color:{_TERRACOTTA};word-break:break-all;">{action_link}</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:18px 36px 0;"><div style="border-top:1px solid #E5DCCB;"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 36px 30px;color:{_MUTED};font-size:12px;line-height:1.6;">
              Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email - sẽ không có tài khoản nào được kích hoạt.
              <br/><br/>
              Trân trọng,<br/>
              <span style="color:{_INK};font-weight:600;">Đội ngũ Bunik (CTY TNHH 1 MÌNH TÔI)</span>
            </td>
          </tr>
        </table>

        <div style="max-width:520px;margin-top:16px;color:{_MUTED};font-size:11px;
                    font-family:{font};">
          © Bunik · Email tự động, vui lòng không trả lời.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_verification_email(to_email: str, action_link: str, full_name: str = '') -> None:
    """Send the Supabase signup verification link through our own mailer.

    Delivery channel is chosen by settings.EMAIL_PROVIDER:
      - 'resend': Resend HTTP API over 443 (not blocked by Railway egress)
      - anything else: Django SMTP backend
    """
    greeting = f'Chào {full_name},' if full_name else 'Xin chào,'
    subject = 'Xác minh email tài khoản Bunik'
    text_body = (
        f'{greeting}\n\n'
        'Cảm ơn bạn đã đăng ký tài khoản Bunik. Vui lòng mở liên kết bên dưới '
        'để xác minh email và kích hoạt tài khoản:\n\n'
        f'{action_link}\n\n'
        'Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.\n\n'
        'Trân trọng,\nĐội ngũ Bunik'
    )
    html_body = _build_html(greeting, action_link)

    if getattr(settings, 'EMAIL_PROVIDER', 'smtp').lower() == 'resend':
        _send_via_resend(to_email, subject, text_body, html_body)
    else:
        _send_via_smtp(to_email, subject, text_body, html_body)


def _send_via_smtp(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    reply_to = [settings.EMAIL_HOST_USER] if getattr(settings, 'EMAIL_HOST_USER', '') else None
    message = EmailMultiAlternatives(
        subject, text_body, settings.DEFAULT_FROM_EMAIL, [to_email], reply_to=reply_to,
    )
    message.attach_alternative(html_body, 'text/html')
    _attach_logo(message)
    message.send(fail_silently=False)


def _send_via_resend(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    api_key = getattr(settings, 'RESEND_API_KEY', '')
    if not api_key:
        raise RuntimeError('RESEND_API_KEY is not configured')

    payload = {
        'from': settings.DEFAULT_FROM_EMAIL,
        'to': [to_email],
        'subject': subject,
        'text': text_body,
        'html': html_body,
    }
    logo = _logo_attachment_for_resend()
    if logo:
        payload['attachments'] = [logo]

    req = urlrequest.Request(
        _RESEND_ENDPOINT,
        data=json.dumps(payload).encode('utf-8'),
        method='POST',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            # Cloudflare (in front of Resend) blocks the default urllib UA.
            'User-Agent': 'bunik-backend/1.0',
        },
    )
    try:
        with urlrequest.urlopen(req, timeout=_HTTP_TIMEOUT):
            return
    except HTTPError as exc:
        detail = exc.read().decode('utf-8', 'replace')
        raise RuntimeError(f'Resend API error {exc.code}: {detail}') from exc
    except URLError as exc:
        raise RuntimeError(f'Resend request failed: {exc.reason}') from exc


def _logo_attachment_for_resend() -> dict | None:
    """Inline logo as a CID attachment so the cid: reference in the HTML resolves."""
    try:
        encoded = base64.b64encode(_LOGO_PATH.read_bytes()).decode('ascii')
    except Exception:
        logger.warning('Could not read Bunik logo for Resend attachment.', exc_info=True)
        return None
    return {
        'filename': 'bunik-logo.png',
        'content': encoded,
        'content_id': _LOGO_CID,
    }


def _attach_logo(message: EmailMultiAlternatives) -> None:
    """Embed the logo as an inline (CID) image so it renders without external hosting."""
    try:
        logo = MIMEImage(_LOGO_PATH.read_bytes())
        logo.add_header('Content-ID', f'<{_LOGO_CID}>')
        logo.add_header('Content-Disposition', 'inline', filename='bunik-logo.png')
        message.mixed_subtype = 'related'
        message.attach(logo)
    except Exception:
        # Missing logo should never block the verification email itself.
        logger.warning('Could not attach Bunik logo to verification email.', exc_info=True)
