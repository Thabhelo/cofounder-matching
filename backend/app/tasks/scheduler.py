import logging
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models.user import User
from app.models.event import Event, UserEventRSVP
from app.services.email import send_profile_incomplete_reminder, send_event_reminder

logger = logging.getLogger(__name__)


async def run_incomplete_profile_reminders() -> int:
    """Send reminders to users with incomplete profiles older than 7 days. Returns count sent."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=7)
        users = db.query(User).filter(
            User.profile_status == "incomplete",
            User.is_active,
            ~User.is_banned,
            User.created_at <= cutoff,
        ).all()
        for user in users:
            await send_profile_incomplete_reminder(user)
        logger.info("Incomplete profile reminders sent: %d", len(users))
        return len(users)
    except Exception:
        logger.exception("Error in run_incomplete_profile_reminders")
        return 0
    finally:
        db.close()


async def run_event_reminders() -> int:
    """Send reminders for events starting in the next 20-28 hours. Returns count sent."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        window_start = now + timedelta(hours=20)
        window_end = now + timedelta(hours=28)
        rsvps = (
            db.query(UserEventRSVP, Event, User)
            .join(Event, Event.id == UserEventRSVP.event_id)
            .join(User, User.id == UserEventRSVP.user_id)
            .filter(
                Event.start_datetime >= window_start,
                Event.start_datetime <= window_end,
                Event.is_active,
                User.is_active,
                ~User.is_banned,
            )
            .all()
        )
        for rsvp, event, user in rsvps:
            await send_event_reminder(user, event.title, str(event.start_datetime))
        logger.info("Event reminders sent: %d", len(rsvps))
        return len(rsvps)
    except Exception:
        logger.exception("Error in run_event_reminders")
        return 0
    finally:
        db.close()
