"""
In-memory feature flags for runtime email/notification control.

Flags reset to defaults on server restart. Toggle them via the admin API
at POST /api/v1/admin/notifications/config.
"""
from typing import Dict

_flags: Dict[str, bool] = {
    "welcome_email": True,
    "intro_accepted_notification": True,
    "incomplete_profile_reminder": True,
    "event_reminder": True,
}

FLAG_LABELS: Dict[str, str] = {
    "welcome_email": "Welcome email (sent on first onboarding)",
    "intro_accepted_notification": "Intro accepted notification (sent to requester when accepted)",
    "incomplete_profile_reminder": "Incomplete profile reminder (weekly scheduled job)",
    "event_reminder": "Event reminder (daily scheduled job, 20-28h before event)",
}


def get_flag(name: str) -> bool:
    return _flags.get(name, True)


def set_flag(name: str, value: bool) -> None:
    if name in _flags:
        _flags[name] = value


def get_all_flags() -> Dict[str, bool]:
    return dict(_flags)
