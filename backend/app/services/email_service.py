"""
Email OTP service using Resend (free tier: 3000 emails/month).
https://resend.com
"""
import httpx
import random
from app.core.config import settings


def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return str(random.randint(100000, 999999))


async def send_otp_email(email: str, otp: str) -> bool:
    """Send OTP to user's email via Resend API."""
    if not settings.RESEND_API_KEY:
        # Dev mode: print OTP to console
        print(f"[DEV] OTP for {email}: {otp}")
        return True

    # Use Resend's default sender if custom domain not verified
    from_email = settings.FROM_EMAIL
    if "crowdbash" in from_email and settings.ENVIRONMENT != "production":
        from_email = "Crowdbash <onboarding@resend.dev>"

    try:
        async with httpx.AsyncClient() as client:
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
            if res.status_code != 200:
                print(f"Resend API error: {res.status_code} - {res.text}")
                return False
            return True
    except Exception as e:
        print(f"Email send error: {e}")
        return False
