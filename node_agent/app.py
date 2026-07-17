import gc
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
from faster_whisper import BatchedInferencePipeline, WhisperModel
from starlette.background import BackgroundTask

APP_KEY = os.environ.get("NODE_KEY", "")
# Fail-closed: sem NODE_KEY o require_key vira no-op e todo endpoint fica
# aberto (só o iptables protege). Exigir a chave no boot evita que um deploy
# sem a env suba "saudável" e sem autenticação. NODE_ALLOW_NO_KEY=true libera
# explicitamente (dev/local).
if not APP_KEY and os.environ.get("NODE_ALLOW_NO_KEY", "").lower() not in {"1", "true", "yes"}:
    raise RuntimeError(
        "NODE_KEY não configurada: o serviço ficaria sem autenticação. "
        "Defina NODE_KEY ou, apenas em dev, NODE_ALLOW_NO_KEY=true."
    )
BASE_DIR = Path(os.environ.get("NODE_DIR", "/tmp/node-agent"))
# Teto de tempo por subprocesso (ffmpeg/ffprobe/yt-dlp). Sem isso, um input
# malformado pendura o processo para sempre e o semáforo de render nunca é
# liberado — o serviço morre em silêncio até restart manual.
SUBPROCESS_TIMEOUT = int(os.environ.get("NODE_SUBPROCESS_TIMEOUT", "3600"))
# Modelos Whisper permitidos: o nome vem do cliente e instancia um WhisperModel
# residente (baixado do HuggingFace). Sem whitelist, nomes variados enchem
# RAM/VRAM e disco indefinidamente.
ALLOWED_MODELS = {
    item.strip()
    for item in os.environ.get(
        "NODE_ALLOWED_MODELS",
        # 'turbo' é o default de produção (NODE_MODEL) — precisa estar aqui.
        "tiny,base,small,medium,turbo,large-v2,large-v3,large-v3-turbo,distil-large-v3",
    ).split(",")
    if item.strip()
}
# O default configurado sempre é permitido, mesmo que NODE_ALLOWED_MODELS
# seja sobrescrito sem ele — senão o prewarm derruba o serviço no boot.
ALLOWED_MODELS.add(os.environ.get("NODE_MODEL", "small"))
# Mídia enviada é apagada pelo cliente (DELETE /v1/media/{id}); se o worker
# crashar no meio, o diretório vaza. Reaper por TTL cobre o órfão.
MEDIA_TTL_SECONDS = int(os.environ.get("NODE_MEDIA_TTL_SECONDS", str(24 * 3600)))
DEFAULT_MODEL = os.environ.get("NODE_MODEL", "small")
DEFAULT_DEVICE = os.environ.get("NODE_DEVICE", "cuda")
DEFAULT_BATCH_SIZE = int(os.environ.get("NODE_BATCH_SIZE", "1"))
DEFAULT_COMPUTE_TYPE = os.environ.get("NODE_COMPUTE_TYPE", "")
MAX_CONCURRENT = int(os.environ.get("NODE_MAX_CONCURRENT", "1"))
PREWARM = os.environ.get("NODE_PREWARM", "true").lower() in {"1", "true", "yes", "on"}
# Descarrega o Whisper da GPU ao fim de cada transcrição (carrega sob demanda,
# devolve a VRAM quando termina). Padrão ligado.
UNLOAD_ASR_AFTER_USE = os.environ.get("NODE_UNLOAD_ASR_AFTER_USE", "true").lower() in {"1", "true", "yes", "on"}
# Descarrega o modelo FACIAL da GPU após N minutos sem render. Diferente do
# Whisper, ele NÃO é descarregado após cada uso: a 1a inferência CUDA faz
# ~1min de autotune, então soltar por corte tornaria cada render lento. O
# unload por inatividade libera a VRAM quando o ViralForge está parado sem
# penalizar renders em sequência. 0 desativa.
FACE_IDLE_UNLOAD_MINUTES = int(os.environ.get("NODE_FACE_IDLE_UNLOAD_MINUTES", "10"))
CACHE_ENABLED = os.environ.get("NODE_CACHE_ENABLED", "true").lower() in {"1", "true", "yes", "on"}
NORMALIZE_AUDIO = os.environ.get("NODE_NORMALIZE_AUDIO", "false").lower() in {"1", "true", "yes", "on"}
FACE_TRACKING_ENABLED = os.environ.get("NODE_FACE_TRACKING_ENABLED", "true").lower() in {"1", "true", "yes", "on"}
FACE_PREWARM = os.environ.get("NODE_FACE_PREWARM", "true").lower() in {"1", "true", "yes", "on"}
FACE_TRACKING_LAYOUTS = {item.strip().upper() for item in os.environ.get("NODE_FACE_TRACKING_LAYOUTS", "SMART_REFRAME,SPEAKER_CLOSEUP").split(",") if item.strip()}
FACE_BACKEND = os.environ.get("NODE_FACE_BACKEND", "scrfd").lower()
FACE_MODEL = os.environ.get("NODE_FACE_MODEL", "buffalo_sc")
YOLO_FACE_MODEL = os.environ.get("NODE_YOLO_FACE_MODEL", str(BASE_DIR / "models" / "yolov11n-face.pt"))
FACE_DEVICE = os.environ.get("NODE_FACE_DEVICE", "cpu").lower()
FACE_DET_SIZE = int(os.environ.get("NODE_FACE_DET_SIZE", "320"))
FACE_SAMPLE_FPS = float(os.environ.get("NODE_FACE_SAMPLE_FPS", "1"))
FACE_MIN_SCORE = float(os.environ.get("NODE_FACE_MIN_SCORE", "0.45"))
FACE_MAX_FRAMES = int(os.environ.get("NODE_FACE_MAX_FRAMES", "240"))
FACE_EMA_ALPHA = float(os.environ.get("NODE_FACE_EMA_ALPHA", "0.30"))
FACE_DEADZONE_RATIO = float(os.environ.get("NODE_FACE_DEADZONE_RATIO", "0.055"))
FACE_MAX_SPEED_RATIO = float(os.environ.get("NODE_FACE_MAX_SPEED_RATIO", "0.70"))
FACE_MAX_ACCEL_RATIO = float(os.environ.get("NODE_FACE_MAX_ACCEL_RATIO", "1.40"))
FACE_HEADROOM_RATIO = float(os.environ.get("NODE_FACE_HEADROOM_RATIO", "0.44"))
FACE_TRACK_DISTANCE_WEIGHT = float(os.environ.get("NODE_FACE_TRACK_DISTANCE_WEIGHT", "1.8"))
FACE_MOVE_THRESHOLD_RATIO = float(os.environ.get("NODE_FACE_MOVE_THRESHOLD_RATIO", "0.18"))
FACE_MOVE_DURATION = float(os.environ.get("NODE_FACE_MOVE_DURATION", "0.35"))
FACE_CENTER_BIAS_Y = float(os.environ.get("NODE_FACE_CENTER_BIAS_Y", "0.44"))
BASE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR = BASE_DIR / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="node-agent", version="1.1")
_models: dict[tuple[str, str], object] = {}
_pipelines: dict[tuple[str, str], BatchedInferencePipeline] = {}
_gpu_lock = threading.Semaphore(MAX_CONCURRENT)
_render_lock = threading.Semaphore(int(os.environ.get("NODE_RENDER_MAX_CONCURRENT", "1")))
_face_app = None
_yolo_face_model = None
_face_lock = threading.Lock()
_SAFE_ID_RE = re.compile(r"^[a-f0-9]{32}$")


class RunRequest(BaseModel):
    url: HttpUrl
    language: Optional[str] = "pt"
    model: Optional[str] = None
    device: Optional[str] = None
    compute_type: Optional[str] = None
    beam_size: int = 5
    batch_size: int = DEFAULT_BATCH_SIZE
    vad_filter: bool = True
    cleanup: bool = True


def require_key(value: Optional[str]) -> None:
    if APP_KEY and value != APP_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")


def call(cmd: list[str], cwd: Path, timeout: Optional[int] = None) -> None:
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            text=True,
            capture_output=True,
            timeout=timeout if timeout is not None else SUBPROCESS_TIMEOUT,
        )
    except subprocess.TimeoutExpired as exc:
        # subprocess.run já mata o processo no timeout; aqui só traduzimos.
        raise RuntimeError(
            f"comando excedeu {exc.timeout}s e foi encerrado: {' '.join(cmd[:3])}"
        ) from exc
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "command failed")[-2000:])


@lru_cache(maxsize=8)
def has_encoder(name: str) -> bool:
    # Cacheado: a lista de encoders do ffmpeg não muda em runtime e cada
    # chamada forkava um processo (~100ms) por render e por /health.
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=30
    )
    return proc.returncode == 0 and name in proc.stdout


@lru_cache(maxsize=1)
def accelerator_ready() -> bool:
    # Cacheado pelo mesmo motivo: chamada até 4x por render.
    try:
        subprocess.run(["nvidia-smi"], capture_output=True, text=True, timeout=5, check=True)
        return True
    except Exception:
        return False


def reap_stale_media() -> int:
    """Remove diretórios de mídia órfãos (cliente crashou antes do DELETE)."""
    if MEDIA_TTL_SECONDS <= 0:
        return 0
    cutoff = time.time() - MEDIA_TTL_SECONDS
    removed = 0
    for entry in MEDIA_DIR.iterdir():
        try:
            if entry.is_dir() and entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed


def safe_media_path(file_id: str) -> Path:
    if not _SAFE_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="invalid file_id")
    media_dir = MEDIA_DIR / file_id
    if not media_dir.exists():
        raise HTTPException(status_code=404, detail="media not found")
    matches = [p for p in media_dir.iterdir() if p.is_file()]
    if not matches:
        raise HTTPException(status_code=404, detail="media file not found")
    return matches[0]


def escape_filter_path(path: Path) -> str:
    return str(path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def ffexpr(value: str) -> str:
    return value.replace(",", r"\,")


def probe_video_size(input_path: Path) -> tuple[int, int]:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=s=x:p=0",
            str(input_path),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0 or "x" not in proc.stdout:
        raise RuntimeError("video size probe failed")
    width, height = proc.stdout.strip().split("x")[:2]
    return int(width), int(height)


def get_face_app():
    global _face_app
    if _face_app is not None:
        return _face_app
    with _face_lock:
        if _face_app is not None:
            return _face_app
        try:
            from insightface.app import FaceAnalysis
        except Exception as exc:
            raise RuntimeError(f"insightface unavailable: {exc}")
        providers = [("CUDAExecutionProvider", {"cudnn_conv_algo_search": "DEFAULT"}), "CPUExecutionProvider"] if FACE_DEVICE == "cuda" and accelerator_ready() else ["CPUExecutionProvider"]
        app_instance = FaceAnalysis(name=FACE_MODEL, allowed_modules=["detection"], providers=providers)
        app_instance.prepare(ctx_id=0 if FACE_DEVICE == "cuda" and accelerator_ready() else -1, det_size=(FACE_DET_SIZE, FACE_DET_SIZE))
        _face_app = app_instance
        return _face_app


def get_yolo_face_model():
    global _yolo_face_model
    if _yolo_face_model is not None:
        return _yolo_face_model
    with _face_lock:
        if _yolo_face_model is not None:
            return _yolo_face_model
        try:
            from ultralytics import YOLO
        except Exception as exc:
            raise RuntimeError(f"ultralytics unavailable: {exc}")
        model_path = Path(YOLO_FACE_MODEL)
        if not model_path.exists():
            raise RuntimeError(f"YOLO face model not found: {model_path}")
        _yolo_face_model = YOLO(str(model_path))
        return _yolo_face_model


def extract_tracking_frames(input_path: Path, job_dir: Path, start: float, end: float, fps: float) -> Path:
    frames_dir = job_dir / "tracking_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    duration = max(1.0, end - start)
    frame_budget_fps = min(max(0.2, fps), max(0.2, FACE_MAX_FRAMES / duration))
    call(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-ss",
            str(start),
            "-t",
            str(duration),
            "-i",
            str(input_path),
            "-vf",
            f"fps={frame_budget_fps},scale=\'min(640,iw)\':-2",
            "-q:v",
            "4",
            str(frames_dir / "frame_%06d.jpg"),
        ],
        job_dir,
    )
    return frames_dir


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


class Kalman1D:
    def __init__(self, process_noise: float = 0.16, measurement_noise: float = 4.0):
        self.process_noise = process_noise
        self.measurement_noise = measurement_noise
        self.value: Optional[float] = None
        self.error = 1.0

    def update(self, measurement: float) -> float:
        if self.value is None:
            self.value = measurement
            return measurement
        self.error += self.process_noise
        gain = self.error / (self.error + self.measurement_noise)
        self.value = self.value + gain * (measurement - self.value)
        self.error = (1 - gain) * self.error
        return self.value


def smooth_crop_position(raw: float, previous: Optional[float], crop_size: int, dt: float, kalman: Kalman1D) -> float:
    if previous is not None:
        deadzone = max(8.0, crop_size * FACE_DEADZONE_RATIO)
        if abs(raw - previous) < deadzone:
            raw = previous
        max_delta = max(12.0, crop_size * FACE_MAX_SPEED_RATIO * max(0.001, dt))
        raw = clamp(raw, previous - max_delta, previous + max_delta)
    filtered = kalman.update(raw)
    if previous is None:
        return filtered
    alpha = clamp(FACE_EMA_ALPHA, 0.05, 0.8)
    return alpha * filtered + (1 - alpha) * previous


def build_hold_expr(values: list[tuple[float, int]]) -> str:
    if not values:
        return "0"
    if len(values) == 1:
        return str(values[0][1])
    expr = str(values[-1][1])
    for idx in range(len(values) - 2, -1, -1):
        t_next = values[idx + 1][0]
        expr = f"if(lt(t\\,{t_next:.3f})\\,{values[idx][1]}\\,{expr})"
    return expr


def build_virtual_camera_positions(samples: list[tuple[float, int]], crop_size: int, duration: float, fps: float) -> list[tuple[float, int]]:
    if not samples:
        return []

    step = 1 / max(0.5, fps)
    sample_idx = 0
    camera = float(samples[0][1])
    velocity = 0.0
    keyframes: list[tuple[float, int]] = []
    last_output: Optional[int] = None
    t = 0.0

    deadzone = max(10.0, crop_size * FACE_DEADZONE_RATIO)
    alpha = clamp(FACE_EMA_ALPHA, 0.04, 0.45)
    max_speed = max(24.0, crop_size * FACE_MAX_SPEED_RATIO)
    max_accel = max(80.0, crop_size * FACE_MAX_ACCEL_RATIO)

    while t <= duration + 0.001:
        while sample_idx + 1 < len(samples) and samples[sample_idx + 1][0] <= t:
            sample_idx += 1
        target = float(samples[sample_idx][1])
        delta = target - camera
        if abs(delta) < deadzone:
            target = camera
            delta = 0.0

        desired_velocity = clamp(delta * alpha / max(0.001, step), -max_speed, max_speed)
        velocity_delta = clamp(desired_velocity - velocity, -max_accel * step, max_accel * step)
        velocity += velocity_delta
        camera += velocity * step

        output = int(round(camera))
        if last_output is None or abs(output - last_output) >= 2:
            keyframes.append((round(t, 3), output))
            last_output = output
        t += step

    if not keyframes:
        return [(0.0, int(round(camera)))]
    if keyframes[0][0] > 0:
        keyframes.insert(0, (0.0, keyframes[0][1]))
    return keyframes


def smart_reframe_filter(input_path: Path, job_dir: Path, start: float, end: float) -> tuple[str, dict]:
    if not FACE_TRACKING_ENABLED:
        raise RuntimeError("face tracking disabled")
    width, height = probe_video_size(input_path)
    aspect = 9 / 16
    if width / height >= aspect:
        crop_h = height - (height % 2)
        crop_w = int(crop_h * aspect)
        crop_w -= crop_w % 2
        axis = "x"
    else:
        crop_w = width - (width % 2)
        crop_h = int(crop_w / aspect)
        crop_h -= crop_h % 2
        axis = "y"
    if crop_w <= 0 or crop_h <= 0 or crop_w > width or crop_h > height:
        raise RuntimeError("invalid crop geometry")

    frames_dir = extract_tracking_frames(input_path, job_dir, start, end, FACE_SAMPLE_FPS)
    frames = sorted(frames_dir.glob("frame_*.jpg"))
    if not frames:
        raise RuntimeError("no tracking frames extracted")

    try:
        import cv2
    except Exception as exc:
        raise RuntimeError(f"opencv unavailable: {exc}")
    backend = FACE_BACKEND
    detector = get_yolo_face_model() if backend == "yolo" else get_face_app()
    yolo_device = 0 if FACE_DEVICE == "cuda" and accelerator_ready() else "cpu"
    raw_positions: list[tuple[float, int]] = []
    previous_face_center: Optional[tuple[float, float]] = None
    effective_fps = len(frames) / max(1.0, end - start)
    for index, frame_path in enumerate(frames):
        image = cv2.imread(str(frame_path))
        if image is None:
            continue
        img_h, img_w = image.shape[:2]
        scale_x = width / max(1, img_w)
        scale_y = height / max(1, img_h)
        if backend == "yolo":
            results = detector.predict(image, imgsz=FACE_DET_SIZE, conf=FACE_MIN_SCORE, device=yolo_device, verbose=False)
            boxes = []
            if results and getattr(results[0], "boxes", None) is not None:
                for box in results[0].boxes:
                    xyxy = box.xyxy[0].detach().cpu().numpy().tolist()
                    conf = float(box.conf[0].detach().cpu().item()) if getattr(box, "conf", None) is not None else 1.0
                    boxes.append((*xyxy, conf))
        else:
            boxes = []
            for face in detector.get(image):
                score = float(getattr(face, "det_score", 1.0) or 0)
                x1, y1, x2, y2 = [float(v) for v in face.bbox]
                boxes.append((x1, y1, x2, y2, score))
        best = None
        best_rank = -1.0
        for x1, y1, x2, y2, score in boxes:
            if score < FACE_MIN_SCORE:
                continue
            x1, x2 = x1 * scale_x, x2 * scale_x
            y1, y2 = y1 * scale_y, y2 * scale_y
            area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            distance_penalty = 0.0
            if previous_face_center is not None:
                distance = ((center_x - previous_face_center[0]) ** 2 + (center_y - previous_face_center[1]) ** 2) ** 0.5
                distance_penalty = (distance / max(1.0, width)) * FACE_TRACK_DISTANCE_WEIGHT * area
            rank = area * max(0.1, score) - distance_penalty
            if rank > best_rank:
                best_rank = rank
                best = (x1, y1, x2, y2)
        if not best:
            continue
        x1, y1, x2, y2 = best
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        previous_face_center = (center_x, center_y)
        if axis == "x":
            # Keep extra room around the face so fast turns do not cut cheeks/forehead.
            raw = clamp(center_x - crop_w * 0.5, 0, width - crop_w)
            crop_size = crop_w
        else:
            raw = clamp(center_y - crop_h * FACE_CENTER_BIAS_Y, 0, height - crop_h)
            crop_size = crop_h
        local_t = index / max(0.001, effective_fps)
        raw_positions.append((local_t, int(round(raw))))

    if not raw_positions:
        raise RuntimeError("no faces detected")
    crop_size = crop_w if axis == "x" else crop_h
    positions = build_virtual_camera_positions(raw_positions, crop_size, max(1.0, end - start), FACE_SAMPLE_FPS)
    if axis == "x":
        x_expr = build_hold_expr(positions)
        y_expr = "0"
    else:
        x_expr = "0"
        y_expr = build_hold_expr(positions)
    return f"[0:v]setpts=PTS-STARTPTS,crop={crop_w}:{crop_h}:{x_expr}:{y_expr},scale=1080:1920[vbase]", {
        "frames": len(frames),
        "detections": len(raw_positions),
        "keyframes": len(positions),
        "axis": axis,
        "source_width": width,
        "source_height": height,
        "crop_width": crop_w,
        "crop_height": crop_h,
        "model": FACE_MODEL,
        "backend": backend,
        "device": str(yolo_device) if backend == "yolo" else FACE_DEVICE,
    }


def video_layout_filter(render_layout: str) -> str:
    layout = (render_layout or "FILL_CROP").upper()
    if layout == "CENTER_FIT":
        return "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black[vbase]"
    if layout == "TOP_FRAME":
        return ";".join([
            "color=c=black:s=1080x1920[canvas]",
            "[0:v]scale=1080:1280:force_original_aspect_ratio=decrease,pad=1080:1280:(ow-iw)/2:(oh-ih)/2:color=black[fg]",
            "[canvas][fg]overlay=0:110[vbase]",
        ])
    if layout == "SMART_CENTER":
        return "[0:v]scale=1920:1920:force_original_aspect_ratio=increase,crop=1920:1080,scale=1080:1920[vbase]"
    if layout == "SPEAKER_CLOSEUP":
        return "[0:v]scale=1440:2560:force_original_aspect_ratio=increase,crop=1080:1920[vbase]"
    if layout == "PODCAST_SPLIT_STATIC":
        return ";".join([
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:8[bg]",
            "[0:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[left]",
            "[0:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[right]",
            "[bg][left]overlay=0:0[bg_left]",
            "[bg_left][right]overlay=540:0[vbase]",
        ])
    if layout == "SCREEN_PLUS_FACE":
        return ";".join([
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=12:4[bg]",
            "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[full]",
            "[bg][full]overlay=(W-w)/2:(H-h)/2[bg_full]",
            "[0:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640[inset]",
            "[bg_full][inset]overlay=W-w-20:H-h-20[vbase]",
        ])
    return "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[vbase]"


def render_video(input_path: Path, subtitle_path: Path, output_path: Path, start: float, end: float, render_layout: str, job_dir: Optional[Path] = None) -> tuple[str, dict]:
    duration = max(1.0, end - start)
    tracking_meta: dict = {"enabled": False, "used": False}
    layout = (render_layout or "FILL_CROP").upper()
    if job_dir is not None and layout in FACE_TRACKING_LAYOUTS:
        t_track = time.perf_counter()
        try:
            base_filter, detected_meta = smart_reframe_filter(input_path, job_dir, start, end)
            tracking_meta = {**detected_meta, "enabled": True, "used": True, "sec": round(time.perf_counter() - t_track, 3)}
        except Exception as exc:
            base_filter = video_layout_filter(render_layout)
            tracking_meta = {"enabled": True, "used": False, "error": str(exc)[-500:], "sec": round(time.perf_counter() - t_track, 3)}
    else:
        base_filter = video_layout_filter(render_layout)
    filter_graph = f"{base_filter};[vbase]subtitles='{escape_filter_path(subtitle_path)}'[v]"
    encoder = "h264_nvenc" if accelerator_ready() and has_encoder("h264_nvenc") else "libx264"
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-ss",
        str(start),
        "-t",
        str(duration),
        "-i",
        str(input_path),
        "-filter_complex",
        filter_graph,
        "-map",
        "[v]",
        "-map",
        "0:a?",
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-c:v",
        encoder,
    ]
    if encoder == "h264_nvenc":
        cmd += ["-preset", os.environ.get("NODE_NVENC_PRESET", "p4"), "-rc", "vbr", "-cq", os.environ.get("NODE_NVENC_CQ", "23"), "-b:v", "0"]
    else:
        cmd += ["-preset", os.environ.get("NODE_X264_PRESET", "veryfast"), "-crf", "23"]
    cmd += ["-c:a", "aac", "-b:a", "128k", "-pix_fmt", "yuv420p", str(output_path)]
    call(cmd, output_path.parent)
    return encoder, tracking_meta

def cache_key(parts: dict) -> str:
    raw = json.dumps(parts, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def read_cache(key: str) -> Optional[dict]:
    if not CACHE_ENABLED:
        return None
    path = CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return None


def write_cache(key: str, payload: dict) -> None:
    if not CACHE_ENABLED:
        return
    tmp = CACHE_DIR / f"{key}.{uuid.uuid4().hex}.tmp"
    final = CACHE_DIR / f"{key}.json"
    tmp.write_text(json.dumps(payload, ensure_ascii=False), "utf-8")
    tmp.replace(final)


def resolve_compute_type(device: str, value: Optional[str] = None) -> str:
    if value:
        return value
    if DEFAULT_COMPUTE_TYPE:
        return DEFAULT_COMPUTE_TYPE
    return "float16" if device == "cuda" else "int8"


def ensure_model_allowed(name: str) -> None:
    # O nome do modelo vem do cliente e instancia um WhisperModel residente
    # (baixado do HuggingFace). Sem whitelist, nomes variados enchem RAM/VRAM
    # e disco indefinidamente — inclusive por engano do worker.
    if name not in ALLOWED_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"modelo não permitido: {name}. Permitidos: {sorted(ALLOWED_MODELS)}",
        )


def get_model(name: str, device: str, compute_type: Optional[str] = None) -> WhisperModel:
    ensure_model_allowed(name)
    resolved_compute_type = resolve_compute_type(device, compute_type)
    key = (name, f"{device}:{resolved_compute_type}")
    if key not in _models:
        _models[key] = WhisperModel(name, device=device, compute_type=resolved_compute_type)
    return _models[key]


def get_pipeline(name: str, device: str, compute_type: Optional[str] = None) -> BatchedInferencePipeline:
    resolved_compute_type = resolve_compute_type(device, compute_type)
    key = (name, f"{device}:{resolved_compute_type}")
    if key not in _pipelines:
        _pipelines[key] = BatchedInferencePipeline(model=get_model(name, device, resolved_compute_type))
    return _pipelines[key]


def unload_transcription_models() -> None:
    """Descarrega os modelos Whisper da VRAM após a transcrição terminar.

    Com NODE_UNLOAD_ASR_AFTER_USE=true (padrão), o Whisper é carregado sob
    demanda e removido da GPU ao fim de cada trabalho, deixando a placa livre
    quando ninguém está transcrevendo. Trade-off: o próximo trabalho paga o
    tempo de recarregar o modelo do disco.
    NÃO afeta o modelo de detecção facial (é outro modelo, outro cache).
    """
    if not _models and not _pipelines:
        return
    _pipelines.clear()
    _models.clear()
    _cuda_empty_cache()


def _cuda_empty_cache() -> None:
    gc.collect()
    try:
        import torch  # ctranslate2/ONNX usam CUDA; empty_cache devolve a VRAM ao driver

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        # torch pode não estar instalado / device CPU: o gc já liberou o objeto.
        pass


def unload_face_models() -> None:
    """Descarrega os modelos de detecção facial da VRAM (bom vizinho em GPU compartilhada)."""
    global _face_app, _yolo_face_model
    with _face_lock:
        had = _face_app is not None or _yolo_face_model is not None
        _face_app = None
        _yolo_face_model = None
    if had:
        _cuda_empty_cache()


# Marca de tempo do último render, para o unload facial por inatividade.
_last_render_activity = time.time()
_activity_lock = threading.Lock()


def touch_render_activity() -> None:
    global _last_render_activity
    with _activity_lock:
        _last_render_activity = time.time()


def _face_idle_unload_loop() -> None:
    while True:
        time.sleep(60)
        if FACE_IDLE_UNLOAD_MINUTES <= 0:
            continue
        with _activity_lock:
            idle_sec = time.time() - _last_render_activity
        if idle_sec < FACE_IDLE_UNLOAD_MINUTES * 60:
            continue
        # O modelo facial é usado no render (_render_lock). Só descarrega se
        # nenhum render estiver em andamento, senão puxaria o modelo do meio.
        if _render_lock.acquire(blocking=False):
            try:
                unload_face_models()
            except Exception as exc:
                print(f"[node-agent] unload facial por inatividade falhou: {exc}", flush=True)
            finally:
                _render_lock.release()


def run_text(
    audio: Path,
    model_name: str,
    device: str,
    language: Optional[str],
    beam_size: int,
    batch_size: int,
    compute_type: Optional[str],
    vad_filter: bool,
):
    # word_timestamps=True: sem isso o consumidor não recebe o tempo de cada
    # palavra e precisa inventá-lo dividindo o segmento igualmente, o que
    # dessincroniza legenda karaokê. Custa ~10-20% a mais de ASR.
    if batch_size > 1 and device == "cuda":
        pipeline = get_pipeline(model_name, device, compute_type)
        segments, info = pipeline.transcribe(
            str(audio),
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter,
            batch_size=batch_size,
            word_timestamps=True,
        )
    else:
        model = get_model(model_name, device, compute_type)
        segments, info = model.transcribe(
            str(audio),
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter,
            word_timestamps=True,
        )

    rows = []
    words = []
    for index, s in enumerate(segments):
        rows.append({"start": s.start, "end": s.end, "text": s.text.strip()})
        for w in (getattr(s, "words", None) or []):
            token = (w.word or "").strip()
            if not token:
                continue
            words.append(
                {
                    "word": token,
                    "start": w.start,
                    "end": w.end,
                    "probability": getattr(w, "probability", None),
                    "segment_index": index,
                }
            )
    return rows, words, info


def normalize_audio(input_audio: Path, output_audio: Path) -> None:
    call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_audio),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(output_audio),
        ],
        input_audio.parent,
    )


def transcribe_audio(
    audio_path: Path,
    model_name: str,
    device: str,
    language: Optional[str],
    beam_size: int,
    batch_size: int,
    compute_type: Optional[str],
    vad_filter: bool,
    timings: dict,
):
    if NORMALIZE_AUDIO:
        normalized_audio = audio_path.parent / "audio-mono16.wav"
        t_norm = time.perf_counter()
        normalize_audio(audio_path, normalized_audio)
        timings["normalize_audio_sec"] = round(time.perf_counter() - t_norm, 3)
    else:
        normalized_audio = audio_path
        timings["normalize_audio_sec"] = 0

    acquired = _gpu_lock.acquire(timeout=60 * 60)
    if not acquired:
        raise RuntimeError("gpu queue timeout")
    try:
        t_asr = time.perf_counter()
        segments, words, info = run_text(normalized_audio, model_name, device, language, beam_size, batch_size, compute_type, vad_filter)
        timings["transcribe_sec"] = round(time.perf_counter() - t_asr, 3)
        return segments, words, info, device
    except Exception as exc:
        if device == "cuda":
            t_asr = time.perf_counter()
            segments, words, info = run_text(normalized_audio, model_name, "cpu", language, beam_size, 1, None, vad_filter)
            timings["transcribe_sec"] = round(time.perf_counter() - t_asr, 3)
            timings["fallback_reason"] = str(exc)[-500:]
            return segments, words, info, "cpu"
        raise
    finally:
        # Retira o Whisper da GPU ao fim do trabalho (deixa a placa livre
        # quando ninguém transcreve). Feito sob o lock, antes de liberá-lo,
        # para não descarregar no meio de outra transcrição concorrente.
        if UNLOAD_ASR_AFTER_USE:
            unload_transcription_models()
        _gpu_lock.release()


def response_payload(
    *,
    job_id: str,
    model_name: str,
    device_requested: str,
    device_used: str,
    compute_type: Optional[str],
    batch_size: int,
    info,
    segments: list,
    timings: dict,
    started: float,
    words: Optional[list] = None,
    cache_hit: bool = False,
) -> dict:
    return {
        "ok": True,
        "job_id": job_id,
        "model": model_name,
        "device_requested": device_requested,
        "device_used": device_used,
        "compute_type": resolve_compute_type(device_used, compute_type),
        "batch_size": batch_size if device_used == "cuda" else 1,
        "language": getattr(info, "language", None),
        "duration": getattr(info, "duration", None),
        "segments": segments,
        # Timestamps reais por palavra (karaokê). Sem isto o consumidor
        # aproxima os tempos dividindo o segmento igualmente.
        "words": words or [],
        "timings": {**timings, "total_sec": round(time.perf_counter() - started, 3)},
        "cache_hit": cache_hit,
    }


def prewarm_face_model() -> None:
    try:
        if FACE_BACKEND == "yolo":
            model = get_yolo_face_model()
            # Aquecimento: a 1a inferência CUDA do ONNX leva ~1min (autotune de
            # kernels cuDNN). Rodar aqui, no thread de boot, paga esse custo uma
            # vez e evita o plateau no 1o render real do usuário.
            try:
                import numpy as _np
                model.predict(
                    _np.zeros((640, 640, 3), dtype="uint8"),
                    verbose=False,
                    device=FACE_DEVICE,
                )
            except Exception as warm_exc:
                print(f"face warmup inference skipped: {warm_exc}", flush=True)
        else:
            get_face_app()
        print("face model prewarmed OK", flush=True)
    except Exception as exc:
        print(f"face prewarm skipped: {exc}", flush=True)


def _media_reaper_loop() -> None:
    while True:
        try:
            removed = reap_stale_media()
            if removed:
                print(f"[node-agent] reaper removeu {removed} diretório(s) de mídia órfãos", flush=True)
        except Exception as exc:  # nunca derruba a thread
            print(f"[node-agent] reaper falhou: {exc}", flush=True)
        time.sleep(3600)


@app.on_event("startup")
def startup() -> None:
    # Não pré-aquece o Whisper se ele deve ser descarregado após o uso: seria
    # incoerente carregar no boot só para o primeiro job removê-lo.
    if PREWARM and not UNLOAD_ASR_AFTER_USE:
        get_model(DEFAULT_MODEL, DEFAULT_DEVICE, DEFAULT_COMPUTE_TYPE or None)
    if FACE_TRACKING_ENABLED and FACE_PREWARM:
        threading.Thread(target=prewarm_face_model, daemon=True).start()
    if MEDIA_TTL_SECONDS > 0:
        threading.Thread(target=_media_reaper_loop, daemon=True).start()
    if FACE_IDLE_UNLOAD_MINUTES > 0:
        threading.Thread(target=_face_idle_unload_loop, daemon=True).start()


@app.get("/health")
def health():
    return {
        "ok": True,
        "accelerator": accelerator_ready(),
        "nvenc": has_encoder("h264_nvenc"),
        "models_loaded": [f"{m}:{d}" for (m, d) in _models.keys()],
        "max_concurrent": MAX_CONCURRENT,
        "render_max_concurrent": int(os.environ.get("NODE_RENDER_MAX_CONCURRENT", "1")),
        "cache_enabled": CACHE_ENABLED,
        "prewarm": PREWARM,
        "normalize_audio": NORMALIZE_AUDIO,
        "face_tracking_enabled": FACE_TRACKING_ENABLED,
        "face_tracking_layouts": sorted(FACE_TRACKING_LAYOUTS),
        "face_model": FACE_MODEL,
        "face_backend": FACE_BACKEND,
        "yolo_face_model": YOLO_FACE_MODEL if FACE_BACKEND == "yolo" else None,
        "face_device": FACE_DEVICE,
        "face_prewarm": FACE_PREWARM,
        "face_model_loaded": (_yolo_face_model is not None) if FACE_BACKEND == "yolo" else (_face_app is not None),
    }


@app.post("/v1/media")
def upload_media(
    file: UploadFile = File(...),
    x_node_key: Optional[str] = Header(default=None),
):
    require_key(x_node_key)
    file_id = uuid.uuid4().hex
    media_dir = MEDIA_DIR / file_id
    media_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "input.mp4").suffix or ".bin"
    media_path = media_dir / f"input{suffix}"
    digest = hashlib.sha256()
    size = 0
    try:
        with media_path.open("wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                digest.update(chunk)
                out.write(chunk)
        return {"ok": True, "file_id": file_id, "sha256": digest.hexdigest(), "bytes": size}
    except Exception as exc:
        shutil.rmtree(media_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc)[-2000:])


@app.delete("/v1/media/{file_id}")
def delete_media(file_id: str, x_node_key: Optional[str] = Header(default=None)):
    require_key(x_node_key)
    if not _SAFE_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="invalid file_id")
    shutil.rmtree(MEDIA_DIR / file_id, ignore_errors=True)
    return {"ok": True}


@app.post("/v1/render-clip")
def render_clip(
    file_id: str = Form(...),
    subtitle: UploadFile = File(...),
    start: float = Form(...),
    end: float = Form(...),
    render_layout: str = Form(default="FILL_CROP"),
    x_node_key: Optional[str] = Header(default=None),
):
    require_key(x_node_key)
    touch_render_activity()
    input_path = safe_media_path(file_id)
    job_id = uuid.uuid4().hex
    job_dir = BASE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    subtitle_path = job_dir / "subtitle.ass"
    output_path = job_dir / "clip.mp4"
    started = time.perf_counter()
    acquired = _render_lock.acquire(timeout=60 * 60)
    if not acquired:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=503, detail="render queue timeout")
    try:
        with subtitle_path.open("wb") as out:
            while True:
                chunk = subtitle.file.read(256 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        encoder, tracking_meta = render_video(input_path, subtitle_path, output_path, start, end, render_layout, job_dir)
        headers = {
            "x-node-render-engine": f"ffmpeg:{encoder}",
            "x-node-render-sec": str(round(time.perf_counter() - started, 3)),
            "x-node-face-tracking": "1" if tracking_meta.get("used") else "0",
            "x-node-face-tracking-sec": str(tracking_meta.get("sec", 0)),
            "x-node-face-backend": str(tracking_meta.get("backend", FACE_BACKEND)),
        }
        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename="clip.mp4",
            headers=headers,
            background=BackgroundTask(lambda: shutil.rmtree(job_dir, ignore_errors=True)),
        )
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc)[-2000:])
    finally:
        _render_lock.release()


@app.post("/v1/thumbnail")
def thumbnail(
    file_id: str = Form(...),
    start: float = Form(...),
    x_node_key: Optional[str] = Header(default=None),
):
    require_key(x_node_key)
    touch_render_activity()
    input_path = safe_media_path(file_id)
    job_id = uuid.uuid4().hex
    job_dir = BASE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    output_path = job_dir / "thumb.jpg"
    try:
        call(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-ss",
                str(start + 2),
                "-i",
                str(input_path),
                "-vf",
                "scale=540:960:force_original_aspect_ratio=increase,crop=540:960",
                "-frames:v",
                "1",
                "-q:v",
                "3",
                str(output_path),
            ],
            job_dir,
        )
        return FileResponse(
            output_path,
            media_type="image/jpeg",
            filename="thumb.jpg",
            background=BackgroundTask(lambda: shutil.rmtree(job_dir, ignore_errors=True)),
        )
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc)[-2000:])


@app.post("/v1/process")
def process(req: RunRequest, x_node_key: Optional[str] = Header(default=None)):
    require_key(x_node_key)
    job_id = uuid.uuid4().hex
    job_dir = BASE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    timings = {}
    model_name = req.model or DEFAULT_MODEL
    device = req.device or DEFAULT_DEVICE
    try:
        key = cache_key({
            "kind": "url",
            "url": str(req.url),
            "language": req.language,
            "model": model_name,
            "device": device,
            "compute_type": resolve_compute_type(device, req.compute_type),
            "beam_size": req.beam_size,
            "batch_size": req.batch_size,
            "vad_filter": req.vad_filter,
            "normalize_audio": NORMALIZE_AUDIO,
        })
        cached = read_cache(key)
        if cached:
            cached["cache_hit"] = True
            return cached

        t0 = time.perf_counter()
        call(
            [
                sys.executable,
                "-m",
                "yt_dlp",
                "--no-playlist",
                "-x",
                "--audio-format",
                "wav",
                "--audio-quality",
                "0",
                "-o",
                "audio.%(ext)s",
                str(req.url),
            ],
            job_dir,
        )
        timings["download_audio_sec"] = round(time.perf_counter() - t0, 3)
        audio_files = list(job_dir.glob("audio*.wav"))
        if not audio_files:
            raise RuntimeError("audio file not found")

        segments, words, info, device_used = transcribe_audio(
            audio_files[0], model_name, device, req.language, req.beam_size, req.batch_size, req.compute_type, req.vad_filter, timings
        )
        payload = response_payload(
            job_id=job_id,
            model_name=model_name,
            device_requested=device,
            device_used=device_used,
            compute_type=req.compute_type,
            batch_size=req.batch_size,
            info=info,
            segments=segments,
            words=words,
            timings=timings,
            started=started,
        )
        write_cache(key, payload)
        return payload
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[-2000:])
    finally:
        if req.cleanup:
            shutil.rmtree(job_dir, ignore_errors=True)


@app.post("/v1/transcribe-file")
def transcribe_file(
    file: UploadFile = File(...),
    language: Optional[str] = Form(default="pt"),
    model: Optional[str] = Form(default=None),
    device: Optional[str] = Form(default=None),
    compute_type: Optional[str] = Form(default=None),
    beam_size: int = Form(default=5),
    batch_size: int = Form(default=DEFAULT_BATCH_SIZE),
    vad_filter: bool = Form(default=True),
    cleanup: bool = Form(default=True),
    x_node_key: Optional[str] = Header(default=None),
):
    require_key(x_node_key)
    job_id = uuid.uuid4().hex
    job_dir = BASE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    timings = {}
    model_name = model or DEFAULT_MODEL
    requested_device = device or DEFAULT_DEVICE
    try:
        suffix = Path(file.filename or "audio").suffix or ".bin"
        uploaded = job_dir / f"input{suffix}"
        digest = hashlib.sha256()
        with uploaded.open("wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
                out.write(chunk)
        file_hash = digest.hexdigest()
        key = cache_key({
            "kind": "file",
            "sha256": file_hash,
            "language": language,
            "model": model_name,
            "device": requested_device,
            "compute_type": resolve_compute_type(requested_device, compute_type),
            "beam_size": beam_size,
            "batch_size": batch_size,
            "vad_filter": vad_filter,
            "normalize_audio": NORMALIZE_AUDIO,
        })
        cached = read_cache(key)
        if cached:
            cached["cache_hit"] = True
            return cached

        segments, words, info, device_used = transcribe_audio(
            uploaded, model_name, requested_device, language, beam_size, batch_size, compute_type, vad_filter, timings
        )
        payload = response_payload(
            job_id=job_id,
            model_name=model_name,
            device_requested=requested_device,
            device_used=device_used,
            compute_type=compute_type,
            batch_size=batch_size,
            info=info,
            segments=segments,
            words=words,
            timings=timings,
            started=started,
        )
        payload["file_sha256"] = file_hash
        write_cache(key, payload)
        return payload
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[-2000:])
    finally:
        if cleanup:
            shutil.rmtree(job_dir, ignore_errors=True)
