from __future__ import annotations

import json
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel

from scripts.yolo_gemini_overlay import (
    generate_job_paths,
    process_video_with_yolo_and_gemini,
)


router = APIRouter(prefix="/video", tags=["Video Pipeline"])
BASE_DIR = Path(__file__).resolve().parents[1]

# In-memory index for easy lookup from job id.
JOB_INDEX: dict[str, dict[str, str]] = {}


class VideoJobResponse(BaseModel):
    job_id: str
    frames_processed: int
    frames_output: int
    person_events: int
    gemini_events: int
    frame_stride: int
    processing_preset: str
    gemini_mode: str
    gemini_debug: dict[str, str]
    output_video_download: str
    events_download: str


@router.post("/analyze", response_model=VideoJobResponse)
async def analyze_uploaded_video(
    video: UploadFile = File(...),
    processing_preset: str = Form(default="fast"),
    gemini_mode: str = Form(default="keyframe"),
    yolo_model_name: str | None = Form(default=None),
) -> VideoJobResponse:
    content_type = (video.content_type or "").lower()
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a video")

    if processing_preset not in {"fast", "balanced", "quality"}:
        raise HTTPException(status_code=400, detail="processing_preset must be one of: fast, balanced, quality")
    if gemini_mode not in {"keyframe", "full_video"}:
        raise HTTPException(status_code=400, detail="gemini_mode must be one of: keyframe, full_video")

    try:
        job_id, input_path, output_path, events_path = generate_job_paths(str(BASE_DIR))

        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

        result = await run_in_threadpool(
            process_video_with_yolo_and_gemini,
            input_path,
            output_path,
            events_path,
            yolo_model_name=yolo_model_name,
            processing_preset=processing_preset,
            gemini_mode=gemini_mode,
        )

        JOB_INDEX[job_id] = {
            "output_video": result.output_video_path,
            "events_json": result.events_json_path,
        }

        return VideoJobResponse(
            job_id=job_id,
            frames_processed=result.frames_processed,
            frames_output=result.frames_output,
            person_events=result.person_events,
            gemini_events=result.gemini_events,
            frame_stride=result.frame_stride,
            processing_preset=result.processing_preset,
            gemini_mode=result.gemini_mode,
            gemini_debug=result.gemini_debug,
            output_video_download=f"/video/jobs/{job_id}/output",
            events_download=f"/video/jobs/{job_id}/events",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video processing failed: {exc}") from exc
    finally:
        video.file.close()


@router.get("/jobs/{job_id}/output")
async def download_output_video(job_id: str):
    job = JOB_INDEX.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    output_path = Path(job["output_video"])
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output video missing")

    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"{job_id}_output_overlay.mp4",
    )


@router.get("/jobs/{job_id}/events")
async def download_events_json(job_id: str):
    job = JOB_INDEX.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    events_path = Path(job["events_json"])
    if not events_path.exists():
        raise HTTPException(status_code=404, detail="Events file missing")

    return FileResponse(
        events_path,
        media_type="application/json",
        filename=f"{job_id}_events.json",
    )


@router.get("/jobs/{job_id}")
async def get_job_metadata(job_id: str):
    job = JOB_INDEX.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    events_path = Path(job["events_json"])
    if events_path.exists():
        with open(events_path, "r", encoding="utf-8") as f:
            events = json.load(f)
        return {
            "job_id": job_id,
            "output_video_download": f"/video/jobs/{job_id}/output",
            "events_download": f"/video/jobs/{job_id}/events",
            "events_count": len(events),
        }

    return {
        "job_id": job_id,
        "output_video_download": f"/video/jobs/{job_id}/output",
        "events_download": f"/video/jobs/{job_id}/events",
        "events_count": 0,
    }
