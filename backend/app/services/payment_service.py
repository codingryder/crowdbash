"""
Razorpay payment service using direct HTTP API.
Bypasses the razorpay SDK entirely to avoid pkg_resources issues.
Docs: https://razorpay.com/docs/api/orders/create
"""
import httpx
import hashlib
import hmac
from app.core.config import settings


RAZORPAY_API_BASE = "https://api.razorpay.com/v1"


def _auth() -> tuple[str, str]:
    return (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)


async def create_order(amount_paise: int, receipt: str) -> dict:
    """Create a Razorpay order via HTTP API."""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{RAZORPAY_API_BASE}/orders",
            auth=_auth(),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "payment_capture": 1,
            },
        )
        if res.status_code != 200:
            raise Exception(f"Razorpay error: {res.status_code} - {res.text}")
        return res.json()


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature using HMAC-SHA256."""
    message = f"{order_id}|{payment_id}"
    expected = hmac.HMAC(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
