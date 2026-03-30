"""WebSocket endpoint for real-time messaging."""

import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api.deps import verify_clerk_token
from app.config import settings
from app.database import SessionLocal
from app.models.match import Match
from app.models.message import Message
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory connection registry: match_id -> set of (user_id, websocket)
_connections: Dict[str, Set[tuple]] = defaultdict(set)


def _get_user_from_token(token_data: dict, db: Session) -> User | None:
    """Look up user from verified token claims."""
    clerk_id = token_data.get("sub")
    if not clerk_id:
        return None
    return db.query(User).filter(User.clerk_id == clerk_id).first()


async def _broadcast_to_match(match_id: str, message_data: dict, exclude_ws: WebSocket | None = None):
    """Send a message to all connected clients in a match except the sender."""
    payload = json.dumps(message_data, default=str)
    dead = []
    for user_id, ws in _connections.get(match_id, set()):
        if ws is exclude_ws:
            continue
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append((user_id, ws))
    # Clean up dead connections
    for conn in dead:
        _connections[match_id].discard(conn)


@router.websocket("/ws/chat/{match_id}")
async def websocket_chat(websocket: WebSocket, match_id: str):
    """
    WebSocket endpoint for real-time messaging.

    Connect with: ws://host/ws/chat/{match_id}?token=<clerk_jwt>

    Send: {"type": "message", "content": "hello"}
    Receive: {"type": "message", "id": "...", "sender_id": "...", "content": "...", "created_at": "..."}
    Receive: {"type": "read", "match_id": "..."} (when other user reads messages)
    """
    # Validate origin in production
    origin = websocket.headers.get("origin", "")
    allowed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
    if settings.ENVIRONMENT == "production" and (not origin or origin not in allowed_origins):
        await websocket.close(code=4003, reason="Origin not allowed")
        return

    # Accept connection first, then authenticate via first message
    # (token sent in message body, not URL query — avoids token in server logs)
    await websocket.accept()

    # Wait for auth message (5 second timeout)
    import asyncio
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        data = json.loads(raw)
        if data.get("type") != "auth" or not data.get("token"):
            await websocket.send_text(json.dumps({"type": "auth_error", "detail": "Expected auth message"}))
            await websocket.close(code=4001, reason="Missing auth")
            return
    except (asyncio.TimeoutError, Exception):
        await websocket.close(code=4001, reason="Auth timeout")
        return

    # Verify JWT from auth message
    try:
        token_data = await verify_clerk_token(data["token"])
    except Exception:
        await websocket.send_text(json.dumps({"type": "auth_error", "detail": "Invalid token"}))
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Get user and verify match access
    db = SessionLocal()
    try:
        user = _get_user_from_token(token_data, db)
        if not user:
            await websocket.send_text(json.dumps({"type": "auth_error", "detail": "User not found"}))
            await websocket.close(code=4001, reason="User not found")
            return

        if user.is_banned:
            await websocket.send_text(json.dumps({"type": "auth_error", "detail": "Account banned"}))
            await websocket.close(code=4003, reason="Account banned")
            return

        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            await websocket.send_text(json.dumps({"type": "auth_error", "detail": "Match not found"}))
            await websocket.close(code=4004, reason="Match not found")
            return

        if match.user_id != user.id and match.target_user_id != user.id:
            await websocket.send_text(json.dumps({"type": "auth_error", "detail": "Not authorized"}))
            await websocket.close(code=4003, reason="Not authorized")
            return

        if match.status != "connected":
            await websocket.send_text(json.dumps({"type": "auth_error", "detail": "Match not connected"}))
            await websocket.close(code=4004, reason="Match not connected")
            return

        user_id = str(user.id)
        recipient_id = str(match.target_user_id if match.user_id == user.id else match.user_id)
    finally:
        db.close()

    # Auth successful — register connection
    await websocket.send_text(json.dumps({"type": "auth_ok"}))
    conn_entry = (user_id, websocket)
    _connections[match_id].add(conn_entry)

    logger.info(f"WebSocket authenticated: user={user_id} match={match_id}")

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Invalid JSON"}))
                continue

            msg_type = data.get("type")

            if msg_type == "message":
                content = data.get("content", "").strip()
                if not content:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "Empty message"}))
                    continue
                if len(content) > 5000:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "Message too long (max 5000)"}))
                    continue

                # Save to database
                db = SessionLocal()
                try:
                    # Rate limit check
                    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
                    recent = db.query(Message).filter(
                        Message.sender_id == uuid.UUID(user_id),
                        Message.message_type == "message",
                        Message.created_at >= yesterday
                    ).count()

                    if recent >= 50:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "detail": "Rate limit: 50 messages/day"
                        }))
                        continue

                    message = Message(
                        match_id=uuid.UUID(match_id),
                        sender_id=uuid.UUID(user_id),
                        recipient_id=uuid.UUID(recipient_id),
                        content=content,
                        message_type="message"
                    )
                    db.add(message)

                    # Update match timestamp
                    m = db.query(Match).filter(Match.id == match_id).first()
                    if m:
                        m.updated_at = datetime.now(timezone.utc)

                    db.commit()
                    db.refresh(message)

                    sender = db.query(User).filter(User.id == user_id).first()

                    msg_payload = {
                        "type": "message",
                        "id": str(message.id),
                        "match_id": str(message.match_id),
                        "sender_id": str(message.sender_id),
                        "recipient_id": str(message.recipient_id),
                        "content": message.content,
                        "message_type": "message",
                        "is_read": False,
                        "read_at": None,
                        "created_at": str(message.created_at),
                        "sender": {
                            "id": str(sender.id),
                            "name": sender.name,
                            "avatar_url": sender.avatar_url,
                        } if sender else None,
                    }
                finally:
                    db.close()

                # Send confirmation to sender
                await websocket.send_text(json.dumps(msg_payload, default=str))
                # Broadcast to other participants
                await _broadcast_to_match(match_id, msg_payload, exclude_ws=websocket)

            elif msg_type == "read":
                # Mark all messages as read
                db = SessionLocal()
                try:
                    db.query(Message).filter(
                        Message.match_id == uuid.UUID(match_id),
                        Message.recipient_id == uuid.UUID(user_id),
                        Message.is_read == False,
                    ).update({
                        "is_read": True,
                        "read_at": datetime.now(timezone.utc),
                    })
                    db.commit()
                finally:
                    db.close()

                await _broadcast_to_match(match_id, {
                    "type": "read",
                    "match_id": match_id,
                    "reader_id": user_id,
                }, exclude_ws=websocket)

            elif msg_type == "key_exchange":
                # Forward public key to the other user(s) in this match
                public_key = data.get("public_key")
                if not public_key:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "Missing public_key"}))
                    continue
                await _broadcast_to_match(match_id, {
                    "type": "key_exchange",
                    "user_id": user_id,
                    "public_key": public_key,
                }, exclude_ws=websocket)

            elif msg_type == "media":
                # Notify other user that encrypted media was uploaded
                # The actual encrypted file is uploaded via REST /api/v1/media/upload
                media_id = data.get("media_id")
                iv = data.get("iv")
                file_name = data.get("file_name")
                file_type = data.get("file_type")
                file_size = data.get("file_size")
                message_id = data.get("message_id")

                if not media_id or not iv:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "Missing media_id or iv"}))
                    continue

                media_payload = {
                    "type": "media",
                    "id": message_id,
                    "media_id": media_id,
                    "match_id": match_id,
                    "sender_id": user_id,
                    "recipient_id": recipient_id,
                    "iv": iv,
                    "file_name": file_name or "file",
                    "file_type": file_type or "application/octet-stream",
                    "file_size": file_size or 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

                # Send confirmation to sender
                await websocket.send_text(json.dumps(media_payload, default=str))
                # Broadcast to recipient
                await _broadcast_to_match(match_id, media_payload, exclude_ws=websocket)

            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            else:
                await websocket.send_text(json.dumps({"type": "error", "detail": f"Unknown type: {msg_type}"}))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: user={user_id} match={match_id}")
    except Exception as e:
        logger.error(f"WebSocket error: user={user_id} match={match_id} error={e}")
    finally:
        _connections[match_id].discard(conn_entry)
        if not _connections[match_id]:
            del _connections[match_id]
