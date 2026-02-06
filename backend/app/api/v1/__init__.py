from fastapi import APIRouter
from app.api.v1 import users, organizations, resources, events, profiles, matches, messages

api_router = APIRouter()

api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(matches.router, prefix="/matches", tags=["matches"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
