from __future__ import annotations

import re
from pathlib import Path
from threading import Event
from typing import Any, Callable
from urllib.parse import urlsplit

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError, download_range_func

from .models import DownloadRequest, DownloadResult


ProgressCallback = Callable[[str, int | None, int | None], None]
ALLOWED_FORMATS = {"mp4", "webm", "mkv"}


class AcquisitionError(Exception):
    def __init__(self, code: str, message: str, retryable: bool) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class _CollectorLogger:
    def __init__(self) -> None:
        self.errors: list[str] = []

    def debug(self, _message: str) -> None:
        return

    def warning(self, message: str) -> None:
        self._append(message)

    def error(self, message: str) -> None:
        self._append(message)

    def _append(self, message: str) -> None:
        sanitized = re.sub(r"https?://\S+", "[url]", str(message))
        self.errors.append(sanitized[-2000:])
        self.errors = self.errors[-4:]


def _validated_proxy(proxy_url: str | None) -> str | None:
    if not proxy_url:
        return None
    parsed = urlsplit(proxy_url)
    if parsed.scheme not in {"http", "https", "socks5", "socks5h"} or not parsed.hostname:
        raise AcquisitionError(
            "provider_configuration_error", "The configured acquisition proxy is invalid.", False
        )
    return proxy_url


def resolve_output_directory(requested: str, root: Path) -> Path:
    resolved_root = root.resolve()
    resolved = Path(requested).resolve()
    if resolved == resolved_root or not resolved.is_relative_to(resolved_root):
        raise AcquisitionError(
            "invalid_output_path", "The acquisition output directory is outside the worker sandbox.", False
        )
    resolved.mkdir(parents=True, exist_ok=True, mode=0o700)
    return resolved


def _extractor_args(request: DownloadRequest, pot_provider_url: str | None) -> dict[str, dict[str, list[str]]]:
    client = {
        "web-safari": "web_safari",
        "web-embedded": "web_embedded",
        "android-vr": "android_vr",
        "mweb-pot": "mweb",
    }.get(request.strategy)
    args: dict[str, dict[str, list[str]]] = {}
    if client:
        args["youtube"] = {"player_client": [client]}
    if request.strategy == "mweb-pot":
        if not pot_provider_url:
            raise AcquisitionError(
                "provider_configuration_error",
                "The proof-of-origin provider is unavailable for this strategy.",
                False,
            )
        parsed = urlsplit(pot_provider_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
            raise AcquisitionError(
                "provider_configuration_error", "The proof-of-origin provider URL is invalid.", False
            )
        args["youtubepot-bgutilhttp"] = {"base_url": [pot_provider_url.rstrip("/")]}
    return args


def build_ydl_options(
    request: DownloadRequest,
    output_directory: Path,
    cancel_event: Event,
    progress: ProgressCallback,
    *,
    maximum_bytes: int,
    pot_provider_url: str | None = None,
    sleep_interval_seconds: float = 5.0,
    maximum_sleep_interval_seconds: float = 10.0,
    request_sleep_interval_seconds: float = 1.0,
) -> dict[str, Any]:
    if not (
        5.0 <= sleep_interval_seconds <= 10.0
        and sleep_interval_seconds <= maximum_sleep_interval_seconds <= 10.0
        and 0.0 <= request_sleep_interval_seconds <= 5.0
    ):
        raise AcquisitionError(
            "provider_configuration_error",
            "The configured acquisition pacing is outside its safe bounds.",
            False,
        )
    duration_bound = int(request.maximum_duration_seconds * 1.05 + 5)
    format_selector = (
        f"bestvideo[height<={request.maximum_height}]+bestaudio/"
        f"best[height<={request.maximum_height}]/best"
    )

    def match_filter(info: dict[str, Any], *, incomplete: bool) -> str | None:
        if incomplete:
            return None
        if info.get("is_live") or info.get("live_status") in {"is_live", "is_upcoming"}:
            return "Live YouTube media is unsupported"
        duration = info.get("duration")
        if isinstance(duration, (int, float)) and duration > duration_bound:
            return "YouTube media exceeds the reserved duration"
        return None

    def progress_hook(status: dict[str, Any]) -> None:
        if cancel_event.is_set():
            raise DownloadError("cancelled")
        if status.get("status") == "downloading":
            current = status.get("downloaded_bytes")
            total = status.get("total_bytes") or status.get("total_bytes_estimate")
            progress("downloading", int(current) if isinstance(current, (int, float)) else None,
                     int(total) if isinstance(total, (int, float)) else None)
        elif status.get("status") == "finished":
            progress("postprocessing", None, None)

    options: dict[str, Any] = {
        "noplaylist": True,
        "overwrites": False,
        "restrictfilenames": True,
        "quiet": True,
        "no_warnings": True,
        "nopart": True,
        "format": format_selector,
        "merge_output_format": request.output_format,
        "cachedir": False,
        "source_address": "0.0.0.0",
        "retries": 3,
        "fragment_retries": 3,
        "sleep_interval": sleep_interval_seconds,
        "max_sleep_interval": maximum_sleep_interval_seconds,
        "sleep_interval_requests": request_sleep_interval_seconds,
        "max_filesize": maximum_bytes,
        "match_filter": match_filter,
        "outtmpl": str(output_directory / "yt-source.%(ext)s"),
        "js_runtimes": {"node": {}},
        "extractor_args": _extractor_args(request, pot_provider_url),
        "proxy": _validated_proxy(request.proxy_url),
        "progress_hooks": [progress_hook],
        "logger": _CollectorLogger(),
    }
    if request.source_section:
        options["external_downloader"] = {"default": "ffmpeg"}
        options["download_ranges"] = download_range_func(
            None,
            [(request.source_section.start_seconds, request.source_section.end_seconds)],
        )
    return options


def classify_failure(details: str, cancelled: bool = False) -> AcquisitionError:
    message = details.lower()
    if cancelled or "cancelled" in message:
        return AcquisitionError("cancelled", "The YouTube acquisition was cancelled.", False)
    if "private video" in message or "video is private" in message:
        return AcquisitionError("video_private", "This YouTube video is private.", False)
    if "age-restricted" in message or "age restricted" in message:
        return AcquisitionError(
            "video_age_restricted", "This YouTube video is age-restricted and cannot be imported.", False
        )
    if "not available in your country" in message or "geo restriction" in message:
        return AcquisitionError(
            "video_region_restricted", "This YouTube video is not available in the worker region.", False
        )
    if "drm" in message:
        return AcquisitionError(
            "video_drm_protected", "This YouTube video is DRM-protected and cannot be imported.", False
        )
    if "sign in to confirm" in message or "not a bot" in message or "http error 403" in message:
        return AcquisitionError(
            "provider_auth_challenge", "YouTube blocked this request from the server network.", True
        )
    if "http error 429" in message or "too many requests" in message:
        return AcquisitionError(
            "provider_rate_limited", "YouTube temporarily rate-limited the acquisition worker.", True
        )
    if "live youtube media" in message or "reserved duration" in message:
        return AcquisitionError(
            "unsupported_video", "The YouTube video is live or exceeds the reserved duration.", False
        )
    if "video unavailable" in message or "has been removed" in message:
        return AcquisitionError("video_unavailable", "This YouTube video is unavailable.", False)
    if "larger than max-filesize" in message or "exceeds max-filesize" in message:
        return AcquisitionError(
            "file_too_large", "The YouTube video exceeds the configured maximum file size.", False
        )
    return AcquisitionError(
        "provider_temporary_failure", "YouTube could not be reached through this acquisition path.", True
    )


def _find_output(output_directory: Path, maximum_bytes: int) -> tuple[Path, str, int]:
    candidates: list[Path] = []
    for item in output_directory.iterdir():
        if item.is_symlink() or not item.is_file():
            continue
        extension = item.suffix.lower().lstrip(".")
        if extension in ALLOWED_FORMATS:
            candidates.append(item)
    if len(candidates) != 1:
        raise AcquisitionError(
            "ytdlp_no_output", "The Python acquisition engine did not produce one media artifact.", True
        )
    output = candidates[0].resolve()
    if not output.is_relative_to(output_directory.resolve()):
        raise AcquisitionError("invalid_output_path", "The media artifact escaped its task directory.", False)
    size = output.stat().st_size
    if size <= 0:
        raise AcquisitionError("ytdlp_no_output", "The downloaded media artifact is empty.", True)
    if size > maximum_bytes:
        raise AcquisitionError(
            "file_too_large", "The downloaded media exceeds the configured maximum file size.", False
        )
    return output, output.suffix.lower().lstrip("."), size


def run_download(
    request: DownloadRequest,
    *,
    root: Path,
    maximum_bytes: int,
    cancel_event: Event,
    progress: ProgressCallback,
    pot_provider_url: str | None = None,
    sleep_interval_seconds: float = 5.0,
    maximum_sleep_interval_seconds: float = 10.0,
    request_sleep_interval_seconds: float = 1.0,
) -> DownloadResult:
    output_directory = resolve_output_directory(request.output_directory, root)
    if any(output_directory.iterdir()):
        raise AcquisitionError(
            "output_directory_not_empty", "The isolated acquisition directory is not empty.", True
        )
    options = build_ydl_options(
        request,
        output_directory,
        cancel_event,
        progress,
        maximum_bytes=maximum_bytes,
        pot_provider_url=pot_provider_url,
        sleep_interval_seconds=sleep_interval_seconds,
        maximum_sleep_interval_seconds=maximum_sleep_interval_seconds,
        request_sleep_interval_seconds=request_sleep_interval_seconds,
    )
    logger = options["logger"]
    progress("extracting", None, None)
    try:
        with YoutubeDL(options) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={request.video_id}"])
    except AcquisitionError:
        raise
    except Exception as error:
        details = "\n".join([*logger.errors, str(error)])
        raise classify_failure(details, cancel_event.is_set()) from None
    if cancel_event.is_set():
        raise classify_failure("cancelled", True)
    output, extension, size = _find_output(output_directory, maximum_bytes)
    return DownloadResult(
        bytes=size,
        filename=str(output),
        format=extension,
        section_applied=request.source_section is not None,
    )
