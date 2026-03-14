from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import cv2
from dotenv import load_dotenv
from google import genai
from google.genai import types
from ultralytics import YOLO


load_dotenv()


@dataclass
class VideoProcessResult:
    output_video_path: str
    events_json_path: str
    frames_processed: int
    frames_output: int
    person_events: int
    gemini_events: int
    frame_stride: int
    processing_preset: str
    gemini_mode: str
    gemini_debug: dict


def _parse_caption_alert(text: str) -> tuple[str, str]:
    caption = "Unknown situation"
    alert_level = "LOW"

    for line in text.splitlines():
        if line.startswith("Caption:"):
            caption = line.replace("Caption:", "", 1).strip() or caption
        elif line.startswith("Alert Level:"):
            value = line.replace("Alert Level:", "", 1).strip().upper()
            if value in {"LOW", "MEDIUM", "HIGH"}:
                alert_level = value

    return caption, alert_level


def _analyze_video_with_gemini(client: genai.Client, input_video_path: str) -> tuple[str, str, dict]:
    video_path = Path(input_video_path)
    debug: dict[str, str] = {
        "gemini_path": "full_video",
        "video_file": str(video_path),
    }

    prompt = (
        "Analyze this drone/city surveillance video. "
        "Identify disaster context (flooding, debris, fire, blocked roads) and human risk. "
        "Return exactly two lines:\n"
        "Caption: <short sentence>\n"
        "Alert Level: <LOW|MEDIUM|HIGH>"
    )

    try:
        uploaded_file = client.files.upload(file=str(video_path))
        response = client.models.generate_content(model="gemini-2.5-flash", contents=[prompt, uploaded_file])
        text = (response.text or "").strip()
        debug["method"] = "files.upload"
        debug["status"] = "ok"
    except Exception as upload_exc:
        debug["upload_error"] = repr(upload_exc)
        # Fallback path if file upload is not available in the running SDK setup.
        try:
            with open(video_path, "rb") as f:
                video_bytes = f.read()

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    prompt,
                    types.Part.from_bytes(data=video_bytes, mime_type="video/mp4"),
                ],
            )
            text = (response.text or "").strip()
            debug["method"] = "part.from_bytes(video/mp4)"
            debug["status"] = "ok"
        except Exception as fallback_exc:
            debug["fallback_error"] = repr(fallback_exc)
            debug["status"] = "error"
            return "Gemini analysis failed", "LOW", debug

    if not text:
        debug["empty_response"] = "true"

    caption, alert = _parse_caption_alert(text)
    if caption == "Unknown situation":
        debug["parse_warning"] = "Caption format not found in Gemini response"
    return caption, alert, debug


def _extract_middle_frame(input_video_path: str):
    cap = cv2.VideoCapture(input_video_path)
    if not cap.isOpened():
        return None
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        mid = max(0, total // 2)
        cap.set(cv2.CAP_PROP_POS_FRAMES, mid)
        ok, frame = cap.read()
        if ok:
            return frame
        return None
    finally:
        cap.release()


def _analyze_keyframe_with_gemini(client: genai.Client, frame) -> tuple[str, str, dict]:
    debug: dict[str, str] = {
        "gemini_path": "keyframe",
        "method": "part.from_bytes(image/jpeg)",
    }
    prompt = (
        "Analyze this drone/city surveillance frame. "
        "Identify disaster context (flooding, debris, fire, blocked roads) and human risk. "
        "Return exactly two lines:\n"
        "Caption: <short sentence>\n"
        "Alert Level: <LOW|MEDIUM|HIGH>"
    )
    try:
        ok, encoded = cv2.imencode(".jpg", frame)
        if not ok:
            debug["status"] = "error"
            debug["encoding_error"] = "cv2.imencode returned false"
            return "Frame encoding failed", "LOW", debug
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                types.Part.from_bytes(data=encoded.tobytes(), mime_type="image/jpeg"),
            ],
        )
        text = (response.text or "").strip()
        debug["status"] = "ok"
    except Exception as exc:
        debug["status"] = "error"
        debug["exception"] = repr(exc)
        return "Gemini analysis failed", "LOW", debug

    if not text:
        debug["empty_response"] = "true"
    caption, alert = _parse_caption_alert(text)
    if caption == "Unknown situation":
        debug["parse_warning"] = "Caption format not found in Gemini response"
    return caption, alert, debug


def _resolve_processing_preset(processing_preset: str, input_fps: float) -> tuple[int, int]:
    preset = processing_preset.lower()
    if preset == "quality":
        target_fps = input_fps
        yolo_imgsz = 960
    elif preset == "balanced":
        target_fps = min(input_fps, 8.0)
        yolo_imgsz = 640
    else:
        target_fps = min(input_fps, 4.0)
        yolo_imgsz = 512

    if target_fps <= 0:
        target_fps = input_fps if input_fps > 0 else 24.0

    frame_stride = max(1, int(round((input_fps if input_fps > 0 else 24.0) / target_fps)))
    return frame_stride, yolo_imgsz


def process_video_with_yolo_and_gemini(
    input_video_path: str,
    output_video_path: str,
    events_json_path: str,
    *,
    yolo_model_name: str | None = None,
    processing_preset: str = "fast",
    gemini_mode: str = "keyframe",
) -> VideoProcessResult:
    """
    Runs sampled-frame YOLO person detection and Gemini captioning,
    then writes overlays into an output video and logs events as JSON.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    resolved_yolo_model = yolo_model_name or os.getenv("YOLO_MODEL", "yolov8n.pt")
    model = YOLO(resolved_yolo_model)
    client = genai.Client(api_key=api_key)

    input_path = Path(input_video_path)
    output_path = Path(output_video_path)
    events_path = Path(events_json_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    events_path.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise RuntimeError("Could not open uploaded video")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    frame_stride, yolo_imgsz = _resolve_processing_preset(processing_preset, fps)
    output_fps = max(1.0, fps / frame_stride)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")

    writer = cv2.VideoWriter(str(output_path), fourcc, output_fps, (width, height))
    if not writer.isOpened():
        cap.release()
        raise RuntimeError("Could not create output video file")

    if gemini_mode.lower() == "full_video":
        latest_caption, latest_alert, gemini_debug = _analyze_video_with_gemini(client, str(input_path))
        gemini_source = "full_video"
    else:
        key_frame = _extract_middle_frame(str(input_path))
        if key_frame is None:
            latest_caption, latest_alert = "No key frame available", "LOW"
            gemini_debug = {
                "gemini_path": "keyframe",
                "status": "error",
                "reason": "could_not_extract_middle_frame",
            }
        else:
            latest_caption, latest_alert, gemini_debug = _analyze_keyframe_with_gemini(client, key_frame)
        gemini_source = "keyframe"

    gemini_debug["source"] = gemini_source
    gemini_debug["mode"] = gemini_mode

    frame_index = 0
    frames_output = 0
    first_frame_fallback = None
    events: list[dict] = [
        {
            "timestamp": datetime.now().isoformat(),
            "event_type": "situation_analysis",
            "caption": latest_caption,
            "alert_level": latest_alert,
            "frame_index": 0,
            "source": gemini_source,
            "debug": gemini_debug,
        }
    ]
    person_events = 0
    gemini_events = 1

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            frame_index += 1
            if first_frame_fallback is None:
                first_frame_fallback = frame.copy()

            # Sample from the first frame, then every Nth frame.
            if (frame_index - 1) % frame_stride != 0:
                continue

            frames_output += 1
            iso_ts = datetime.now().isoformat()

            # 1) YOLO pass on sampled frames
            person_count = 0
            yolo_results = model(frame, verbose=False, imgsz=yolo_imgsz)
            for result in yolo_results:
                for box in result.boxes:
                    if int(box.cls[0]) == 0:  # person in COCO
                        person_count += 1
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(
                            frame,
                            "Person",
                            (x1, max(y1 - 10, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.6,
                            (0, 255, 0),
                            2,
                        )

            if person_count > 0:
                person_events += 1
                events.append(
                    {
                        "timestamp": iso_ts,
                        "event_type": "person_detected",
                        "count": person_count,
                        "frame_index": frame_index,
                    }
                )

            # 2) Overlay labels
            alert_color = (0, 255, 0)
            if latest_alert == "HIGH":
                alert_color = (0, 0, 255)
            elif latest_alert == "MEDIUM":
                alert_color = (0, 165, 255)

            cv2.rectangle(frame, (10, 10), (width - 10, 90), (0, 0, 0), -1)
            cv2.putText(
                frame,
                f"People: {person_count}",
                (20, 38),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )
            cv2.putText(
                frame,
                f"[{latest_alert}] {latest_caption}",
                (20, 72),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                alert_color,
                2,
            )

            writer.write(frame)

        # Guard: if no sampled frame was written (very short clips), write one fallback frame.
        if frames_output == 0 and first_frame_fallback is not None:
            fallback = first_frame_fallback
            alert_color = (0, 255, 0)
            if latest_alert == "HIGH":
                alert_color = (0, 0, 255)
            elif latest_alert == "MEDIUM":
                alert_color = (0, 165, 255)

            cv2.rectangle(fallback, (10, 10), (width - 10, 90), (0, 0, 0), -1)
            cv2.putText(
                fallback,
                "People: 0",
                (20, 38),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )
            cv2.putText(
                fallback,
                f"[{latest_alert}] {latest_caption}",
                (20, 72),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                alert_color,
                2,
            )
            writer.write(fallback)
            frames_output = 1
    finally:
        cap.release()
        writer.release()

    with open(events_path, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2)

    return VideoProcessResult(
        output_video_path=str(output_path),
        events_json_path=str(events_path),
        frames_processed=frame_index,
        frames_output=frames_output,
        person_events=person_events,
        gemini_events=gemini_events,
        frame_stride=frame_stride,
        processing_preset=processing_preset,
        gemini_mode=gemini_mode,
        gemini_debug=gemini_debug,
    )


def generate_job_paths(base_dir: str) -> tuple[str, str, str, str]:
    job_id = str(uuid.uuid4())
    jobs_dir = Path(base_dir) / "artifacts" / "video_jobs" / job_id
    jobs_dir.mkdir(parents=True, exist_ok=True)

    input_path = jobs_dir / "input.mp4"
    output_path = jobs_dir / "output_overlay.mp4"
    events_path = jobs_dir / "events.json"
    return job_id, str(input_path), str(output_path), str(events_path)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="YOLO + Gemini overlay processor")
    parser.add_argument("input_video", help="Input video path")
    parser.add_argument("--output", default="output_overlay.mp4", help="Output video path")
    parser.add_argument("--events", default="events.json", help="Output events JSON path")
    parser.add_argument("--preset", default="fast", choices=["fast", "balanced", "quality"])
    parser.add_argument("--gemini-mode", default="keyframe", choices=["keyframe", "full_video"])
    parser.add_argument("--yolo-model", default=None, help="YOLO model name/path, e.g. yolov8n.pt")
    args = parser.parse_args()

    result = process_video_with_yolo_and_gemini(
        input_video_path=args.input_video,
        output_video_path=args.output,
        events_json_path=args.events,
        yolo_model_name=args.yolo_model,
        processing_preset=args.preset,
        gemini_mode=args.gemini_mode,
    )
    print(result)
