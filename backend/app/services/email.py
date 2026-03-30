import logging
from typing import Optional, Tuple

import httpx

from app.config import settings
from app.models.user import User
from app.services.feature_flags import get_flag


logger = logging.getLogger(__name__)


def _should_send_notification(recipient: User, notification_key: str) -> bool:
    """Check if a user wants to receive a specific notification type.

    Checks the granular settings JSONB first (e.g. settings.notifications.email_intro_request),
    then falls back to the legacy alert_on_new_matches boolean.
    """
    if recipient.settings and isinstance(recipient.settings, dict):
        notifications = recipient.settings.get("notifications", {})
        if notification_key in notifications:
            return bool(notifications[notification_key])
    # Fallback to legacy field
    return bool(recipient.alert_on_new_matches)


def _unsubscribe_footer(frontend_url: str) -> Tuple[str, str]:
    """Return (plain_text_footer, html_footer) with unsubscribe link."""
    url = f"{frontend_url}/profile#preferences"
    plain = (
        "\n\n---\n"
        f"To update your notification preferences, visit: {url}"
    )
    html = (
        "<hr style='margin:24px 0;border:none;border-top:1px solid #e5e7eb;'>"
        "<p style='font-size:12px;color:#6b7280;'>"
        f"To update your notification preferences, visit "
        f"<a href='{url}'>your profile preferences</a>."
        "</p>"
    )
    return plain, html


async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> None:
    """
    Send a transactional email via Resend.

    If email configuration is missing, this becomes a no-op and logs in development.
    """
    if not settings.RESEND_API_KEY or not settings.EMAIL_FROM:
        if settings.ENVIRONMENT == "development":
            logger.info(
                "Email send skipped - RESEND_API_KEY or EMAIL_FROM not configured. "
                f"Subject={subject!r} to={to_email!r}"
            )
        return

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.EMAIL_FROM,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_body,
                    "text": text_body or "",
                },
            )
        if response.status_code >= 400:
            logger.error(
                "Failed to send email via Resend: status=%s body=%s",
                response.status_code,
                response.text,
            )
    except Exception as exc:
        logger.exception("Error while sending email via Resend: %s", exc)


async def send_welcome_email(user: User) -> None:
    """
    Send a welcome email to a newly onboarded user.

    Gated by the welcome_email feature flag.
    """
    if not get_flag("welcome_email"):
        return
    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)

    subject = "Welcome to the Co-Founder Matching Platform"
    text_body = (
        f"Hi {user.name or 'there'},\n\n"
        "Welcome! Your profile has been created on the co-founder matching platform.\n"
        "You can now browse potential co-founders and start connecting.\n\n"
        "Best,\n"
        "Cofounder Matching"
    ) + plain_footer
    html_body = (
        f"<p>Hi {user.name or 'there'},</p>"
        "<p>Welcome! Your profile has been created on the co-founder matching platform.</p>"
        "<p>You can now browse potential co-founders and start connecting.</p>"
        "<p>Best,<br>Cofounder Matching</p>"
    ) + html_footer
    await send_email(user.email, subject, html_body, text_body)


async def send_new_match_notification(
    recipient: User,
    other_user: User,
) -> None:
    """
    Notify a user that someone saved or invited them as a potential co-founder.

    This respects the recipient's notification preferences.
    """
    if not _should_send_notification(recipient, "email_new_match"):
        return

    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)

    subject = "You have a new potential co-founder match"
    text_body = (
        f"Hi {recipient.name or 'there'},\n\n"
        f"{other_user.name or 'Someone'} just showed interest in connecting with you on the co-founder matching platform.\n"
        "Log in to review their profile and decide whether you want to move forward.\n\n"
        "Best,\n"
        "Cofounder Matching"
    ) + plain_footer
    html_body = (
        f"<p>Hi {recipient.name or 'there'},</p>"
        f"<p><strong>{other_user.name or 'Someone'}</strong> just showed interest in connecting with you on the co-founder matching platform.</p>"
        "<p>Log in to review their profile and decide whether you want to move forward.</p>"
        "<p>Best,<br>Cofounder Matching</p>"
    ) + html_footer
    await send_email(recipient.email, subject, html_body, text_body)


async def send_intro_request_notification(
    recipient: User,
    requester: User,
) -> None:
    """
    Notify a user that they received a new introduction request for an existing match.

    This respects the recipient's notification preferences.
    """
    if not _should_send_notification(recipient, "email_intro_request"):
        return

    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)

    subject = "You received a new introduction request"
    text_body = (
        f"Hi {recipient.name or 'there'},\n\n"
        f"{requester.name or 'Someone'} just requested an introduction to you on the co-founder matching platform.\n"
        "Log in to review the request and respond.\n\n"
        "Best,\n"
        "Cofounder Matching"
    ) + plain_footer
    html_body = (
        f"<p>Hi {recipient.name or 'there'},</p>"
        f"<p><strong>{requester.name or 'Someone'}</strong> just requested an introduction to you on the co-founder matching platform.</p>"
        "<p>Log in to review the request and respond.</p>"
        "<p>Best,<br>Cofounder Matching</p>"
    ) + html_footer
    await send_email(recipient.email, subject, html_body, text_body)


async def send_intro_accepted_notification(
    recipient: User,
    other_user: User,
) -> None:
    """
    Notify the original requester that their introduction request was accepted.

    Gated by the intro_accepted_notification feature flag and notification preferences.
    """
    if not get_flag("intro_accepted_notification"):
        return
    if not _should_send_notification(recipient, "email_new_match"):
        return

    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)

    subject = "Your introduction request was accepted"
    text_body = (
        f"Hi {recipient.name or 'there'},\n\n"
        f"{other_user.name or 'Someone'} accepted your introduction request on the co-founder matching platform.\n"
        "Log in to start the conversation.\n\n"
        "Best,\n"
        "Cofounder Matching"
    ) + plain_footer
    html_body = (
        f"<p>Hi {recipient.name or 'there'},</p>"
        f"<p><strong>{other_user.name or 'Someone'}</strong> accepted your introduction request on the co-founder matching platform.</p>"
        "<p>Log in to start the conversation.</p>"
        "<p>Best,<br>Cofounder Matching</p>"
    ) + html_footer
    await send_email(recipient.email, subject, html_body, text_body)


async def send_profile_status_notification(user: User) -> None:
    """
    Notify a user when their profile status changes to approved or rejected.
    """
    status = (user.profile_status or "").lower()
    if status not in {"approved", "rejected"}:
        return

    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)

    if status == "approved":
        subject = "Your co-founder profile has been approved"
        text_body = (
            f"Hi {user.name or 'there'},\n\n"
            "Good news - your co-founder profile has been approved.\n"
            "You can now fully use the platform to discover and connect with potential co-founders.\n\n"
            "Best,\n"
            "Cofounder Matching"
        ) + plain_footer
        html_body = (
            f"<p>Hi {user.name or 'there'},</p>"
            "<p>Good news - your co-founder profile has been <strong>approved</strong>.</p>"
            "<p>You can now fully use the platform to discover and connect with potential co-founders.</p>"
            "<p>Best,<br>Cofounder Matching</p>"
        ) + html_footer
    else:
        subject = "Update on your co-founder profile"
        text_body = (
            f"Hi {user.name or 'there'},\n\n"
            "Your co-founder profile was reviewed and was not approved at this time.\n"
            "You can update your profile and try again.\n\n"
            "Best,\n"
            "Cofounder Matching"
        ) + plain_footer
        html_body = (
            f"<p>Hi {user.name or 'there'},</p>"
            "<p>Your co-founder profile was reviewed and was <strong>not approved</strong> at this time.</p>"
            "<p>You can update your profile and try again.</p>"
            "<p>Best,<br>Cofounder Matching</p>"
        ) + html_footer

    await send_email(user.email, subject, html_body, text_body)


async def send_profile_incomplete_reminder(user: User) -> None:
    """
    Remind a user that their profile is incomplete.

    Gated by the incomplete_profile_reminder feature flag.
    """
    if not get_flag("incomplete_profile_reminder"):
        return
    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)

    subject = "Complete your co-founder profile"
    text_body = (
        f"Hi {user.name or 'there'},\n\n"
        "Your co-founder profile is still incomplete.\n"
        "A complete profile helps you find the right co-founder faster.\n"
        "Log in to finish setting up your profile.\n\n"
        "Best,\n"
        "Cofounder Matching"
    ) + plain_footer
    html_body = (
        f"<p>Hi {user.name or 'there'},</p>"
        "<p>Your co-founder profile is still incomplete.</p>"
        "<p>A complete profile helps you find the right co-founder faster.</p>"
        "<p>Log in to finish setting up your profile.</p>"
        "<p>Best,<br>Cofounder Matching</p>"
    ) + html_footer
    await send_email(user.email, subject, html_body, text_body)


async def send_event_announcement(
    user: User,
    event_title: str,
    event_start: str,
    event_location: str,
) -> None:
    """Announce a new event to a user. Always sends (not gated by feature flag)."""
    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)
    subject = f"New event: {event_title}"
    location_line = f"\nLocation: {event_location}" if event_location else ""
    text_body = (
        f"Hi {user.name or 'there'},\n\n"
        "A new event has been added to the co-founder matching platform:\n\n"
        f"{event_title}\nStart: {event_start}{location_line}\n\n"
        "Log in to view details and RSVP.\n\n"
        "Best,\nCofounder Matching"
    ) + plain_footer
    html_body = (
        f"<p>Hi {user.name or 'there'},</p>"
        "<p>A new event has been added:</p>"
        f"<p><strong>{event_title}</strong><br>Start: {event_start}"
        + (f"<br>Location: {event_location}" if event_location else "")
        + "</p>"
        "<p>Log in to view details and RSVP.</p>"
        "<p>Best,<br>Cofounder Matching</p>"
    ) + html_footer
    await send_email(user.email, subject, html_body, text_body)


async def send_event_reminder(
    user: User,
    event_title: str,
    event_start: str,
) -> None:
    """
    Remind a user about an upcoming event they RSVP'd to.

    Gated by the event_reminder feature flag.
    """
    if not get_flag("event_reminder"):
        return
    plain_footer, html_footer = _unsubscribe_footer(settings.FRONTEND_URL)

    subject = f"Reminder: {event_title} is coming up"
    text_body = (
        f"Hi {user.name or 'there'},\n\n"
        f"This is a reminder that you have an upcoming event: {event_title}\n"
        f"Start time: {event_start}\n"
        "Log in to view the full event details.\n\n"
        "Best,\n"
        "Cofounder Matching"
    ) + plain_footer
    html_body = (
        f"<p>Hi {user.name or 'there'},</p>"
        f"<p>This is a reminder that you have an upcoming event: <strong>{event_title}</strong></p>"
        f"<p>Start time: {event_start}</p>"
        "<p>Log in to view the full event details.</p>"
        "<p>Best,<br>Cofounder Matching</p>"
    ) + html_footer
    await send_email(user.email, subject, html_body, text_body)
