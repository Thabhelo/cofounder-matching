"""
Clerk webhook endpoint.

When a user is deleted in Clerk, we remove or deactivate the corresponding user
in our database so that re-signing up with the same email does not hit a duplicate key.
"""
import logging
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.report import Report

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/clerk")
async def clerk_webhook(request: Request):
    """
    Receive Clerk webhooks (e.g. user.deleted).
    Configure this URL in Clerk Dashboard → Webhooks (e.g. https://your-api.com/webhooks/clerk).
    Subscribe to event: user.deleted
    """
    if not settings.CLERK_WEBHOOK_SECRET or not settings.CLERK_WEBHOOK_SECRET.strip():
        logger.warning("CLERK_WEBHOOK_SECRET not set; rejecting webhook")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhooks not configured",
        )

    body = await request.body()
    headers = dict(request.headers)

    try:
        from svix.webhooks import Webhook, WebhookVerificationError

        wh = Webhook(settings.CLERK_WEBHOOK_SECRET.strip())
        msg = wh.verify(body, headers)
    except WebhookVerificationError as e:
        logger.warning(f"Clerk webhook signature verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )
    except Exception as e:
        logger.exception(f"Clerk webhook verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook verification failed",
        )

    event_type = msg.get("type")
    data = msg.get("data") or {}

    if event_type == "user.deleted":
        clerk_id = data.get("id")
        if not clerk_id:
            logger.warning("user.deleted webhook missing data.id")
            return JSONResponse(status_code=200, content={"ok": True})

        db = next(get_db())
        try:
            user = db.query(User).filter(User.clerk_id == clerk_id).first()
            if not user:
                logger.info(f"user.deleted: no local user for clerk_id={clerk_id}")
                return JSONResponse(status_code=200, content={"ok": True})

            # Clear FKs that don't have ON DELETE so we can delete the user
            db.query(Report).filter(Report.reviewed_by == user.id).update(
                {Report.reviewed_by: None}
            )
            db.commit()

            user_id, clerk_id_log = str(user.id), clerk_id
            db.delete(user)
            db.commit()
            logger.info(f"user.deleted: removed user id={user_id} clerk_id={clerk_id_log}")
        except Exception as e:
            db.rollback()
            logger.exception(f"user.deleted: failed to delete user clerk_id={clerk_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user",
            )
        finally:
            db.close()
        return JSONResponse(status_code=200, content={"ok": True})

    # Unhandled event type - acknowledge so Clerk doesn't retry
    logger.debug(f"Clerk webhook unhandled event type: {event_type}")
    return JSONResponse(status_code=200, content={"ok": True})
