from __future__ import annotations

import hashlib
import hmac
import json
from urllib.request import Request, urlopen

from .models import WebhookEvent


def webhook_signature(body: bytes, secret: str) -> str:
    return "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def send_webhook(url: str | None, secret: str | None, event: WebhookEvent) -> bool:
    if not url or not secret:
        return False
    body = json.dumps(event.model_dump(), separators=(",", ":"), sort_keys=True).encode("utf-8")
    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "content-type": "application/json",
            "x-vidrial-signature": webhook_signature(body, secret),
        },
    )
    try:
        with urlopen(request, timeout=5) as response:
            return 200 <= response.status < 300
    except Exception:
        return False
