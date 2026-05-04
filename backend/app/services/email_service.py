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


async def send_voucher_email(
    email: str,
    *,
    recipient_name: str | None,
    match_name: str,
    rank_label: str,
    points: int | None,
    voucher_provider: str,
    voucher_value: str,
    voucher_url: str | None,
    voucher_code: str | None,
    personal_note: str | None,
) -> None:
    """Send a manual reward (e.g. Amazon gift card) email via Resend.

    Either voucher_url or voucher_code (or both) must be provided. The
    template renders whichever is supplied. Best-effort — caller decides
    whether to retry / log.
    """
    if not voucher_url and not voucher_code:
        raise EmailSendError("Either voucher_url or voucher_code is required")

    if not settings.RESEND_API_KEY:
        print(f"[DEV] Voucher email to {email}: {voucher_provider} {voucher_value} -> {voucher_url or voucher_code}")
        return

    from_email = "Crowdbash <noreply@codingryder.com>"
    greeting = f"Hi {recipient_name}," if recipient_name else "Hey there,"

    points_line = f" with <strong>{points} points</strong>" if points is not None else ""
    subject = f"You won! {voucher_provider} {voucher_value} from Crowdbash"

    code_block = ''
    if voucher_code:
        code_block = (
            '<div style="margin: 18px 0;">'
            '<div style="font-size: 11px; color: #6E7A8A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your code</div>'
            f'<div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 18px; font-weight: 700; '
            'background: #FFF8E5; border: 1px dashed #F4B940; border-radius: 10px; padding: 14px 16px; '
            f'color: #1A1A1A; word-break: break-all;">{voucher_code}</div>'
            '</div>'
        )

    button_block = ''
    if voucher_url:
        button_label = "Redeem your voucher →"
        button_block = (
            '<div style="text-align: center; margin: 24px 0;">'
            f'<a href="{voucher_url}" style="display: inline-block; background: #F4B940; color: #111418; '
            f'font-weight: 700; padding: 14px 32px; border-radius: 12px; text-decoration: none;">{button_label}</a>'
            '</div>'
        )

    note_block = ''
    if personal_note:
        safe_note = personal_note.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
        note_block = (
            '<div style="background: #F6F8FA; border-left: 3px solid #F4B940; padding: 12px 14px; '
            'margin: 18px 0; color: #1A1A1A; font-size: 14px; line-height: 1.5; border-radius: 4px;">'
            f'{safe_note}'
            '</div>'
        )

    html = f"""
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1A1A1A;">
            <h2 style="color: #F4B940; font-family: 'Syne', sans-serif; margin: 0 0 24px;">Crowdbash</h2>

            <h3 style="font-size: 22px; margin: 0 0 6px;">🏆 Congratulations!</h3>
            <div style="color: #6E7A8A; font-size: 13px; margin-bottom: 18px;">
                {rank_label} · {match_name}
            </div>

            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
                {greeting}
            </p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
                You finished as <strong>{rank_label}</strong> in the {match_name} room on Crowdbash{points_line}.
                As a thank-you, here's a <strong>{voucher_provider} voucher worth {voucher_value}</strong>.
            </p>

            {note_block}
            {code_block}
            {button_block}

            <p style="color: #6E7A8A; font-size: 12px; margin-top: 28px; line-height: 1.5;">
                If the button above doesn't work, copy this URL into your browser:<br>
                <span style="color: #1A1A1A; word-break: break-all;">{voucher_url or '(see code above)'}</span>
            </p>

            <p style="color: #6E7A8A; font-size: 11px; margin-top: 24px;">
                You're receiving this because you joined a Crowdbash game room and finished in the
                top of the leaderboard. This is a one-off thank-you — not a recurring promotion.
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
        logger.exception("Voucher email transport error to %s: %s", email, e)
        raise EmailSendError(f"Email transport error: {e}") from e

    if res.status_code >= 400:
        logger.error("Resend rejected voucher email to %s: %s %s", email, res.status_code, res.text)
        raise EmailSendError(
            f"Resend rejected send: {res.status_code}",
            status=res.status_code,
            provider_response=res.text,
        )

    try:
        resend_id = res.json().get("id")
    except Exception:
        resend_id = None
    logger.info("Voucher email queued to %s (resend_id=%s, status=%s)", email, resend_id, res.status_code)


async def send_playing_xi_email(
    email: str,
    *,
    match_name: str,
    league: str | None,
    venue: str | None,
    match_date_label: str | None,
    team_a: str,
    team_b: str,
    xi_a: list[str],
    xi_b: list[str],
    benched_count: int | None,
    room_url: str,
) -> None:
    """Notify a room joinee that the official Playing XI has dropped.

    Best-effort: caller should swallow exceptions per-recipient so one bad
    address doesn't block the rest. Falls back to a console print in dev.
    """
    if not settings.RESEND_API_KEY:
        print(f"[DEV] Playing XI email to {email}: {match_name} ({benched_count} benched) -> {room_url}")
        return

    from_email = "Crowdbash <noreply@codingryder.com>"
    meta_parts = [p for p in [league, venue, match_date_label] if p]
    meta_line = " · ".join(meta_parts)
    meta_block = (
        f'<div style="color: #6E7A8A; font-size: 13px; margin-bottom: 16px;">{meta_line}</div>'
        if meta_line else ''
    )

    bench_warning = ''
    if benched_count is not None and benched_count > 0:
        bench_warning = (
            f'<div style="background: rgba(240,90,90,0.08); border: 1px solid rgba(240,90,90,0.25); '
            f'border-radius: 10px; padding: 12px 14px; margin: 16px 0; color: #B33636; font-size: 13px;">'
            f'<strong>{benched_count} of your selected players {"is" if benched_count == 1 else "are"} '
            f'NOT in the announced XI.</strong> Open the room to swap them out before kickoff.'
            f'</div>'
        )

    def team_block(name: str, players: list[str]) -> str:
        rows = ''.join(
            f'<li style="padding: 4px 0; color: #1A1A1A; font-size: 13px;">{i + 1}. {p}</li>'
            for i, p in enumerate(players)
        )
        return (
            f'<div style="flex: 1; min-width: 200px;">'
            f'<div style="font-weight: 700; color: #111418; font-size: 13px; margin-bottom: 6px;">{name}</div>'
            f'<ol style="list-style: none; padding: 0; margin: 0;">{rows}</ol>'
            f'</div>'
        )

    subject = f"Playing XI announced · {match_name}"
    html = f"""
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #F4B940; font-family: 'Syne', sans-serif; margin: 0 0 24px;">Crowdbash</h2>
            <h3 style="font-size: 20px; margin: 0 0 8px;">🚨 Playing XI announced</h3>
            <div style="font-size: 14px; color: #1A1A1A; margin-bottom: 4px;">{match_name}</div>
            {meta_block}
            {bench_warning}
            <div style="display: flex; gap: 24px; flex-wrap: wrap; margin: 16px 0;">
                {team_block(team_a, xi_a)}
                {team_block(team_b, xi_b)}
            </div>
            <div style="text-align: center; margin: 28px 0;">
                <a href="{room_url}" style="display: inline-block; background: #F4B940; color: #111418; font-weight: 700; padding: 14px 32px; border-radius: 12px; text-decoration: none;">Review &amp; edit your team →</a>
            </div>
            <p style="color: #6E7A8A; font-size: 12px; margin-top: 24px;">
                You can edit your XI as many times as you want before the match starts.
                Once it does, your squad locks for the full match.
            </p>
            <p style="color: #6E7A8A; font-size: 11px; margin-top: 16px;">
                You're receiving this because you joined this Crowdbash game room.
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
        logger.exception("Playing XI email transport error to %s: %s", email, e)
        raise EmailSendError(f"Email transport error: {e}") from e

    if res.status_code >= 400:
        logger.error("Resend rejected XI email to %s: %s %s", email, res.status_code, res.text)
        raise EmailSendError(
            f"Resend rejected send: {res.status_code}",
            status=res.status_code,
            provider_response=res.text,
        )

    try:
        resend_id = res.json().get("id")
    except Exception:
        resend_id = None
    logger.info("Playing XI email queued to %s (resend_id=%s, status=%s)", email, resend_id, res.status_code)
