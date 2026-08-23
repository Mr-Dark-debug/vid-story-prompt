import os
from pathlib import Path
from threading import Event

import pytest
from pydantic import ValidationError

from app.downloader import (
    AcquisitionError,
    build_ydl_options,
    classify_failure,
    ensure_ffmpeg_on_path,
    resolve_output_directory,
)
from app.models import DownloadRequest


def request_for(tmp_path: Path, **overrides) -> DownloadRequest:
    values = {
        "request_id": "request_1234567890",
        "job_id": "11111111-1111-4111-8111-111111111111",
        "task_id": "22222222-2222-4222-8222-222222222222",
        "video_id": "dQw4w9WgXcQ",
        "output_directory": str(tmp_path / "attempt"),
        "maximum_duration_seconds": 600,
        "maximum_height": 720,
        "output_format": "mp4",
        "strategy": "standard",
    }
    values.update(overrides)
    return DownloadRequest.model_validate(values)


def test_plan_height_and_section_are_applied(tmp_path: Path) -> None:
    ffmpeg = tmp_path / "bin" / "ffmpeg"
    ffmpeg.parent.mkdir()
    ffmpeg.write_bytes(b"test executable")
    request = request_for(
        tmp_path,
        source_section={"start_seconds": 30, "end_seconds": 45},
        maximum_height=720,
    )
    options = build_ydl_options(
        request,
        tmp_path / "attempt",
        Event(),
        lambda *_: None,
        maximum_bytes=100_000,
        ffmpeg_location=str(ffmpeg),
    )
    assert "height<=720" in options["format"]
    assert options["external_downloader"]["default"] == "ffmpeg"
    assert options["source_address"] == "0.0.0.0"
    assert options["js_runtimes"] == {"node": {}}
    assert options["ffmpeg_location"] == str(ffmpeg.parent)


def test_retired_android_vr_strategy_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        request_for(tmp_path, strategy="android-vr")


def test_bundled_ffmpeg_directory_is_added_to_path(tmp_path: Path, monkeypatch) -> None:
    ffmpeg = tmp_path / "ffmpeg.exe"
    ffmpeg.write_bytes(b"test executable")
    monkeypatch.setenv("PATH", "existing")
    ensure_ffmpeg_on_path(str(ffmpeg))
    assert os.environ["PATH"].split(os.pathsep) == [str(tmp_path), "existing"]


def test_conservative_request_pacing_is_applied(tmp_path: Path) -> None:
    options = build_ydl_options(
        request_for(tmp_path),
        tmp_path / "attempt",
        Event(),
        lambda *_: None,
        maximum_bytes=100_000,
        sleep_interval_seconds=5.0,
        maximum_sleep_interval_seconds=10.0,
        request_sleep_interval_seconds=1.0,
    )
    assert options["sleep_interval"] == 5.0
    assert options["max_sleep_interval"] == 10.0
    assert options["sleep_interval_requests"] == 1.0


@pytest.mark.parametrize(
    ("minimum", "maximum", "request_interval"),
    [(4.9, 10.0, 1.0), (5.0, 10.1, 1.0), (5.0, 10.0, -0.1)],
)
def test_pacing_bounds_cannot_be_bypassed(
    tmp_path: Path, minimum: float, maximum: float, request_interval: float
) -> None:
    with pytest.raises(AcquisitionError) as error:
        build_ydl_options(
            request_for(tmp_path),
            tmp_path / "attempt",
            Event(),
            lambda *_: None,
            maximum_bytes=100_000,
            sleep_interval_seconds=minimum,
            maximum_sleep_interval_seconds=maximum,
            request_sleep_interval_seconds=request_interval,
        )
    assert error.value.code == "provider_configuration_error"


def test_output_directory_must_be_beneath_worker_root(tmp_path: Path) -> None:
    with pytest.raises(AcquisitionError) as error:
        resolve_output_directory(str(tmp_path.parent), tmp_path)
    assert error.value.code == "invalid_output_path"


@pytest.mark.parametrize(
    ("details", "code", "retryable"),
    [
        ("Sign in to confirm you're not a bot", "provider_auth_challenge", True),
        ("HTTP Error 429", "provider_rate_limited", True),
        ("Private video", "video_private", False),
        ("This video contains DRM", "video_drm_protected", False),
    ],
)
def test_failure_classification(details: str, code: str, retryable: bool) -> None:
    failure = classify_failure(details)
    assert failure.code == code
    assert failure.retryable is retryable


def test_proxy_protocol_is_allowlisted(tmp_path: Path) -> None:
    request = request_for(tmp_path, proxy_url="file:///etc/passwd")
    with pytest.raises(AcquisitionError) as error:
        build_ydl_options(
            request,
            tmp_path / "attempt",
            Event(),
            lambda *_: None,
            maximum_bytes=100_000,
        )
    assert error.value.code == "provider_configuration_error"
