from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from typing import Dict, Any
from app.database import CloudinaryManager
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/storage", tags=["Cloudinary Storage"])

@router.post("/upload", response_model=Dict[str, Any])
async def upload_asset(
    file: UploadFile = File(...),
    folder: str = "axis_black_assets",
    current_user: dict = Depends(get_current_user)
):
    """
    Upload image or document file to Cloudinary storage.
    """
    try:
        content = await file.read()
        res = await CloudinaryManager.upload_asset(content, file.filename or "upload.png", folder=folder)
        return {
            "status": "success",
            "filename": file.filename,
            "url": res.get("url"),
            "provider": res.get("provider"),
            "bytes": res.get("bytes")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage upload error: {str(e)}"
        )
