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
