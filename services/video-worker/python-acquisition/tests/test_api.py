from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import DownloadResult


client = TestClient(app)
TOKEN = {"authorization": "Bearer test-acquisition-token-which-is-long"}


def payload(tmp_path: Path) -> dict:
    return {
        "request_id": f"api_request_{abs(hash(str(tmp_path)))}",
        "job_id": "11111111-1111-4111-8111-111111111111",
        "task_id": "22222222-2222-4222-8222-222222222222",
        "video_id": "dQw4w9WgXcQ",
        "output_directory": str(tmp_path / "attempt"),
        "maximum_duration_seconds": 600,
        "maximum_height": 720,
        "output_format": "mp4",
        "strategy": "standard",
    }


def test_authentication_is_required(tmp_path: Path) -> None:
    response = client.post("/v1/downloads", json=payload(tmp_path))
    assert response.status_code == 401


def test_invalid_video_id_is_rejected(tmp_path: Path) -> None:
    request = payload(tmp_path)
    request["video_id"] = "short"
    response = client.post("/v1/downloads", headers=TOKEN, json=request)
    assert response.status_code == 422


def test_submit_is_async_and_idempotent(tmp_path: Path) -> None:
    def completed(request, **_kwargs):
        output = Path(request.output_directory)
        output.mkdir(parents=True, exist_ok=True)
        target = output / "yt-source.mp4"
        target.write_bytes(b"video")
        return DownloadResult(bytes=5, filename=str(target), format="mp4", section_applied=False)

    request = payload(tmp_path)
    with patch("app.main.run_download", side_effect=completed):
        first = client.post("/v1/downloads", headers=TOKEN, json=request)
        second = client.post("/v1/downloads", headers=TOKEN, json=request)
    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["request_id"] == second.json()["request_id"]


def test_request_id_conflict_is_rejected(tmp_path: Path) -> None:
    request = payload(tmp_path)
    with patch("app.main.run_download", side_effect=RuntimeError("held")):
        client.post("/v1/downloads", headers=TOKEN, json=request)
    changed = {**request, "maximum_height": 1080}
    response = client.post("/v1/downloads", headers=TOKEN, json=changed)
    assert response.status_code == 409


def test_health_does_not_disclose_configuration() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
