from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(gt=0)

    @model_validator(mode="after")
    def validate_range(self) -> "SourceSection":
        if self.end_seconds <= self.start_seconds:
            raise ValueError("end_seconds must be greater than start_seconds")
        return self


class DownloadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=16, max_length=160, pattern=r"^[A-Za-z0-9_-]+$")
    job_id: str = Field(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    )
    task_id: str = Field(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    )
    video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")
    output_directory: str = Field(min_length=2, max_length=1024)
    maximum_duration_seconds: float = Field(gt=0, le=21600)
    maximum_height: Literal[720, 1080, 2160]
    output_format: Literal["mp4", "webm", "mkv"] = "mp4"
    strategy: Literal["standard", "web-safari", "mweb-pot", "web-embedded"]
    proxy_url: str | None = Field(default=None, max_length=2048)
    source_section: SourceSection | None = None

    @model_validator(mode="after")
    def validate_section(self) -> "DownloadRequest":
        if self.source_section and self.source_section.end_seconds > self.maximum_duration_seconds:
            raise ValueError("source section exceeds maximum duration")
        return self


class DownloadResult(BaseModel):
    bytes: int = Field(gt=0)
    filename: str
    format: Literal["mp4", "webm", "mkv"]
    section_applied: bool


DownloadState = Literal[
    "accepted",
    "extracting",
    "downloading",
    "postprocessing",
    "completed",
    "failed",
    "cancelled",
]


class DownloadStatus(BaseModel):
    request_id: str
    state: DownloadState
    progress_current: int | None = None
    progress_total: int | None = None
    result: DownloadResult | None = None
    error_code: str | None = None
    error_message: str | None = None
    retryable: bool | None = None


class WebhookEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(min_length=8, max_length=300)
    request_id: str
    job_id: str
    task_id: str
    state: DownloadState
    progress_current: int | None = None
    progress_total: int | None = None
