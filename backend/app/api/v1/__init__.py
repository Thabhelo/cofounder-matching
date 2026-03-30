from fastapi import APIRouter
from app.api.v1 import users, organizations, resources, events, profiles, matches, messages, reports, admin
from app.api.v1 import vetting, admin_review_queue, media

api_router = APIRouter()

api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(matches.router, prefix="/matches", tags=["matches"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(vetting.router, prefix="/vetting", tags=["vetting"])
api_router.include_router(admin_review_queue.router, prefix="/admin-review", tags=["admin-review"])
api_router.include_router(media.router)
