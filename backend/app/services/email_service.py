"""
Email OTP service using Resend (free tier: 3000 emails/month).
https://resend.com
"""
import httpx
import logging
import random
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """Raised when the email provider rejects the send request."""
    def __init__(self, message: str, status: int | None = None, provider_response: str | None = None):
        super().__init__(message)
        self.status = status
        self.provider_response = provider_response


def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return str(random.randint(100000, 999999))


async def send_otp_email(email: str, otp: str) -> None:
    """Send OTP to user's email via Resend API. Raises EmailSendError on failure."""
    if not settings.RESEND_API_KEY:
        # Dev mode: print OTP to console
        print(f"[DEV] OTP for {email}: {otp}")
        return

    from_email = "Crowdbash <noreply@codingryder.com>"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": [email],
                    "subject": f"Crowdbash - Your verification code is {otp}",
                    "html": f"""
                        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #F4B940; font-family: 'Syne', sans-serif;">Crowdbash</h2>
                            <p>Your verification code is:</p>
                            <div style="background: #111418; color: #F4B940; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 12px; letter-spacing: 8px; margin: 20px 0;">
                                {otp}
                            </div>
                            <p style="color: #6E7A8A; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
                        </div>
                    """,
                },
            )
    except httpx.HTTPError as e:
        logger.exception("OTP email transport error to %s: %s", email, e)
        raise EmailSendError(f"Email transport error: {e}") from e

    if res.status_code >= 400:
        logger.error("Resend API rejected send to %s: %s %s", email, res.status_code, res.text)
        raise EmailSendError(
            f"Resend rejected send: {res.status_code}",
            status=res.status_code,
            provider_response=res.text,
        )

    try:
        resend_id = res.json().get("id")
    except Exception:
        resend_id = None
    logger.info("OTP email queued to %s (resend_id=%s, status=%s)", email, resend_id, res.status_code)


async def send_room_invite_email(
    email: str,
    *,
    subject: str,
    intro_html: str,
    match_name: str,
    league: str | None,
    match_format: str | None,
    venue: str | None,
    match_date_label: str | None,
    room_url: str,
) -> None:
    """Send a room invite email via Resend. Raises EmailSendError on failure."""
    if not settings.RESEND_API_KEY:
        print(f"[DEV] Room invite to {email}: {match_name} -> {room_url}")
        return

    from_email = "Crowdbash <noreply@codingryder.com>"
    meta_parts = [p for p in [league, match_format, venue, match_date_label] if p]
    meta_line = " · ".join(meta_parts)
    meta_block = (
        f'<div style="color: #6E7A8A; font-size: 13px; margin-bottom: 20px;">{meta_line}</div>'
        if meta_line else ''
    )

    html = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #F4B940; font-family: 'Syne', sans-serif; margin: 0 0 24px;">Crowdbash</h2>
            <h3 style="font-size: 22px; margin: 0 0 8px;">{match_name}</h3>
            {meta_block}
            <div style="line-height: 1.5; color: #1A1A1A; font-size: 14px;">{intro_html}</div>
            <div style="text-align: center; margin: 28px 0;">
                <a href="{room_url}" style="display: inline-block; background: #F4B940; color: #111418; font-weight: 700; padding: 14px 32px; border-radius: 12px; text-decoration: none;">Join the room →</a>
            </div>
            <p style="color: #6E7A8A; font-size: 12px; margin-top: 32px;">
                You're receiving this because you signed up for Crowdbash.
            </p>
        </div>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": [email],
                    "subject": subject,
                    "html": html,
                },
            )
    except httpx.HTTPError as e:
        logger.exception("Room invite transport error to %s: %s", email, e)
        raise EmailSendError(f"Email transport error: {e}") from e

    if res.status_code >= 400:
        logger.error("Resend rejected room invite to %s: %s %s", email, res.status_code, res.text)
        raise EmailSendError(
            f"Resend rejected send: {res.status_code}",
            status=res.status_code,
            provider_response=res.text,
        )

    try:
        resend_id = res.json().get("id")
    except Exception:
        resend_id = None
    logger.info("Room invite queued to %s (resend_id=%s, status=%s)", email, resend_id, res.status_code)
