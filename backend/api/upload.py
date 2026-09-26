"""
backend/api/upload.py
POST /api/upload — accept a zip file and store the repository.
"""
import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.repository.manager import RepositoryManager, SecurityError

logger = logging.getLogger(__name__)
router = APIRouter()

_manager = RepositoryManager()


class UploadResponse(BaseModel):
    repo_id: str
    name: str
    file_count: int
    status: str


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_repository(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a .zip file containing a Python repository.
    Returns the repo_id to use in subsequent requests.
    """
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .zip files are accepted",
        )

    file_data = await file.read()

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB",
        )

    try:
        repo = _manager.upload(file_data, file.filename, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except SecurityError as exc:
        logger.warning(f"Security violation in upload: {exc}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error(f"Unexpected upload error: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload failed due to a server error",
        )

    return UploadResponse(
        repo_id=repo.id,
        name=repo.name,
        file_count=repo.file_count,
        status=repo.status,
    )
