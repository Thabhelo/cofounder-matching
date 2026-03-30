"""
E2EE Media Upload/Download API.

Stores encrypted media blobs. The server never sees plaintext content —
all encryption/decryption happens client-side using ECDH + AES-GCM.

Files are stored on the local filesystem in development and should be
configured for S3/R2 in production (see MEDIA_STORAGE_PATH).
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.models.message import Message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["media"])

# Storage directory — configurable via environment
MEDIA_DIR = Path(os.environ.get("MEDIA_STORAGE_PATH", "media_uploads"))
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/octet-stream",  # Encrypted blobs don't have a meaningful MIME
}


def _ensure_media_dir():
    """Create media directory if it doesn't exist."""
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_encrypted_media(
    match_id: str = Form(...),
    file: UploadFile = File(...),
    iv: str = Form(...),           # Base64 AES-GCM initialization vector
    file_name: str = Form(...),    # Original filename (for display)
    file_type: str = Form(...),    # Original MIME type (for rendering)
    file_size: int = Form(...),    # Original size in bytes
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload an encrypted media blob.

    The file content is already AES-GCM encrypted by the client.
    The server stores the ciphertext as-is — it cannot read it.

    Returns: media_id, iv, file_name, file_type, file_size
    """
    # Validate match access
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid match ID")

    match = db.query(Match).filter(Match.id == match_uuid).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.user_id != current_user.id and match.target_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if match.status != "connected":
        raise HTTPException(status_code=400, detail="Match not connected")

    # Validate file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum {MAX_FILE_SIZE // (1024*1024)}MB")

    # Read encrypted content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    # Generate media ID and store
    media_id = str(uuid.uuid4())
    _ensure_media_dir()
    media_path = MEDIA_DIR / f"{media_id}.enc"
    media_path.write_bytes(content)

    # Determine recipient
    recipient_id = match.target_user_id if match.user_id == current_user.id else match.user_id

    # Create a message record with full media metadata as JSON
    import json as _json
    media_content = _json.dumps({
        "media_id": media_id,
        "iv": iv,
        "file_name": file_name,
        "file_type": file_type,
        "file_size": file_size,
    })
    message = Message(
        match_id=match_uuid,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=media_content,
        message_type="media",
    )
    db.add(message)

    # Update match timestamp
    match.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    db.refresh(message)

    logger.info(f"Media uploaded: id={media_id} match={match_id} size={len(content)} sender={current_user.id}")

    return {
        "media_id": media_id,
        "message_id": str(message.id),
        "iv": iv,
        "file_name": file_name,
        "file_type": file_type,
        "file_size": file_size,
        "created_at": str(message.created_at),
    }


@router.get("/download/{media_id}")
async def download_encrypted_media(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download an encrypted media blob.

    Returns the raw encrypted bytes. Client must decrypt with their shared key.
    """
    # Validate media_id format
    try:
        uuid.UUID(media_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid media ID")

    # Find the message containing this media (supports both old and new format)
    from sqlalchemy import or_
    message = db.query(Message).filter(
        Message.message_type == "media",
        or_(
            Message.content == f"[media:{media_id}]",      # Legacy format
            Message.content.contains(f'"media_id": "{media_id}"'),  # New JSON format
        ),
    ).first()

    if not message:
        raise HTTPException(status_code=404, detail="Media not found")

    # Verify user is part of this match
    match = db.query(Match).filter(Match.id == message.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.user_id != current_user.id and match.target_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Serve encrypted file
    media_path = MEDIA_DIR / f"{media_id}.enc"
    if not media_path.exists():
        raise HTTPException(status_code=404, detail="Media file not found")

    return FileResponse(
        path=str(media_path),
        media_type="application/octet-stream",
        filename=f"{media_id}.enc",
    )
