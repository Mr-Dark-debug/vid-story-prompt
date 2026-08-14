from __future__ import annotations

import hmac
import os
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event, Lock
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Response

from .downloader import AcquisitionError, run_download
from .models import DownloadRequest, DownloadStatus, WebhookEvent
from .webhooks import send_webhook


def _bounded_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw = os.getenv(name)
    try:
        value = default if raw is None or raw == "" else float(raw)
    except ValueError as error:
        raise AcquisitionError(
            "provider_configuration_error",
            "The configured acquisition pacing is invalid.",
            False,
        ) from error
    if value < minimum or value > maximum:
        raise AcquisitionError(
            "provider_configuration_error",
            "The configured acquisition pacing is outside its safe bounds.",
            False,
        )
    return value


class DownloadRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._statuses: OrderedDict[str, DownloadStatus] = OrderedDict()
        self._requests: dict[str, DownloadRequest] = {}
        self._cancellations: dict[str, Event] = {}
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="vidrial-acquisition")
        self._sequence: dict[str, int] = {}

    def get(self, request_id: str) -> DownloadStatus | None:
        with self._lock:
            return self._statuses.get(request_id)

    def submit(self, request: DownloadRequest) -> DownloadStatus:
        with self._lock:
            previous_request = self._requests.get(request.request_id)
            if previous_request:
                if previous_request != request:
                    raise HTTPException(status_code=409, detail="request_id_conflict")
                return self._statuses[request.request_id]
            self._prune()
            status = DownloadStatus(request_id=request.request_id, state="accepted")
            self._requests[request.request_id] = request
            self._statuses[request.request_id] = status
            cancellation = Event()
            self._cancellations[request.request_id] = cancellation
            self._sequence[request.request_id] = 0
        self._emit(request, status, notify=True)
        self._executor.submit(self._run, request, cancellation)
        return status

    def cancel(self, request_id: str) -> DownloadStatus | None:
        with self._lock:
            cancellation = self._cancellations.get(request_id)
            status = self._statuses.get(request_id)
            if cancellation and status and status.state not in {"completed", "failed", "cancelled"}:
                cancellation.set()
            return status

    def _prune(self) -> None:
        terminal = {"completed", "failed", "cancelled"}
        while len(self._statuses) >= 128:
            key = next((item for item, value in self._statuses.items() if value.state in terminal), None)
            if key is None:
                raise HTTPException(status_code=503, detail="acquisition_capacity_reached")
            self._statuses.pop(key, None)
            self._requests.pop(key, None)
            self._cancellations.pop(key, None)
            self._sequence.pop(key, None)

    def _set(
        self,
        request: DownloadRequest,
        state: str,
        current: int | None = None,
        total: int | None = None,
        *,
        result=None,
        error: AcquisitionError | None = None,
        notify: bool = False,
    ) -> None:
        status = DownloadStatus(
            request_id=request.request_id,
            state=state,
            progress_current=current,
            progress_total=total,
            result=result,
            error_code=error.code if error else None,
            error_message=str(error) if error else None,
            retryable=error.retryable if error else None,
        )
        with self._lock:
            previous = self._statuses.get(request.request_id)
            self._statuses[request.request_id] = status
        self._emit(request, status, notify=notify or previous is None or previous.state != state)

    def _emit(self, request: DownloadRequest, status: DownloadStatus, *, notify: bool) -> None:
        if not notify:
            return
        with self._lock:
            sequence = self._sequence.get(request.request_id, 0) + 1
            self._sequence[request.request_id] = sequence
        event = WebhookEvent(
            event_id=f"{request.request_id}:{status.state}:{sequence}",
            request_id=request.request_id,
            job_id=request.job_id,
            task_id=request.task_id,
            state=status.state,
            progress_current=status.progress_current,
            progress_total=status.progress_total,
        )
        send_webhook(
            os.getenv("VIDRIAL_ACQUISITION_WEBHOOK_URL"),
            os.getenv("VIDRIAL_ACQUISITION_WEBHOOK_SECRET"),
            event,
        )

    def _run(self, request: DownloadRequest, cancellation: Event) -> None:
        last_notified_state: str | None = None

        def progress(state: str, current: int | None, total: int | None) -> None:
            nonlocal last_notified_state
            notify = state != last_notified_state
            last_notified_state = state
            self._set(request, state, current, total, notify=notify)

        try:
            result = run_download(
                request,
                root=Path(os.getenv("VIDRIAL_ACQUISITION_ROOT", "/tmp/vidrial")),
                maximum_bytes=int(os.getenv("MAX_DIRECT_DOWNLOAD_BYTES", str(2 * 1024**3))),
                cancel_event=cancellation,
                progress=progress,
                pot_provider_url=os.getenv("YTDLP_POT_PROVIDER_URL"),
                sleep_interval_seconds=_bounded_float(
                    "YTDLP_SLEEP_INTERVAL_SECONDS", 5.0, 5.0, 10.0
                ),
                maximum_sleep_interval_seconds=_bounded_float(
                    "YTDLP_MAX_SLEEP_INTERVAL_SECONDS", 10.0, 5.0, 10.0
                ),
                request_sleep_interval_seconds=_bounded_float(
                    "YTDLP_REQUEST_SLEEP_INTERVAL_SECONDS", 1.0, 0.0, 5.0
                ),
            )
            self._set(request, "completed", result=result, notify=True)
        except AcquisitionError as error:
            state = "cancelled" if error.code == "cancelled" else "failed"
            self._set(request, state, error=error, notify=True)
        except Exception:
            error = AcquisitionError(
                "provider_temporary_failure", "The Python acquisition engine stopped unexpectedly.", True
            )
            self._set(request, "failed", error=error, notify=True)


registry = DownloadRegistry()
app = FastAPI(
    title="Vidrial internal acquisition",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    secret = os.getenv("VIDRIAL_ACQUISITION_TOKEN")
    expected = f"Bearer {secret}" if secret else ""
    if not expected or not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/downloads", status_code=202, response_model=DownloadStatus)
async def create_download(
    request: DownloadRequest, _: None = Depends(require_token)
) -> DownloadStatus:
    return registry.submit(request)


@app.get("/v1/downloads/{request_id}", response_model=DownloadStatus)
async def get_download(request_id: str, _: None = Depends(require_token)) -> DownloadStatus:
    status = registry.get(request_id)
    if not status:
        raise HTTPException(status_code=404, detail="download_not_found")
    return status


@app.delete("/v1/downloads/{request_id}", status_code=202)
async def cancel_download(request_id: str, _: None = Depends(require_token)) -> Response:
    if not registry.cancel(request_id):
        raise HTTPException(status_code=404, detail="download_not_found")
    return Response(status_code=202)
