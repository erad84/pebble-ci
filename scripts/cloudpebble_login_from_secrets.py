#!/usr/bin/env python3
"""Bootstrap pebble-tool Firebase credentials from CI secrets (never prints secrets).

Writes XDG path: $HOME/.local/share/pebble-sdk/oauth_firebase/firebase_oauth_storage.json

The CloudPebble install action then bind-mounts that oauth_firebase directory onto
/home/pebble/.pebble-sdk/oauth_firebase inside the SDK Docker image. That image's
entrypoint prefers the legacy ~/.pebble-sdk tree, so mounting into the legacy
oauth path is required for `pebble login --status` / `pebble install --cloudpebble`
to see the bootstrapped credentials.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

DEFAULT_API_KEY = "AIzaSyBZ9Cdvwwv9At2lPmc8TxyyEqSXGXejGvc"
DEFAULT_PROJECT_ID = "coreapp-ce061"


def die(msg: str, code: int = 1) -> None:
    print(f"cloudpebble-login: {msg}", file=sys.stderr)
    raise SystemExit(code)


def main() -> None:
    refresh = (os.environ.get("PEBBLE_FIREBASE_REFRESH_TOKEN") or "").strip()
    if not refresh:
        die("PEBBLE_FIREBASE_REFRESH_TOKEN is empty")

    api_key = (os.environ.get("PEBBLE_FIREBASE_API_KEY") or "").strip() or DEFAULT_API_KEY
    project_id = (os.environ.get("PEBBLE_FIREBASE_PROJECT_ID") or "").strip() or DEFAULT_PROJECT_ID
    home = Path(os.environ.get("HOME") or "").expanduser()
    if not home.as_posix():
        die("HOME is not set")

    cred_dir = home / ".local" / "share" / "pebble-sdk" / "oauth_firebase"
    cred_dir.mkdir(parents=True, exist_ok=True)
    cred_path = cred_dir / "firebase_oauth_storage.json"

    url = f"https://securetoken.googleapis.com/v1/token?key={urllib.parse.quote(api_key)}"
    body = urllib.parse.urlencode(
        {"grant_type": "refresh_token", "refresh_token": refresh}
    ).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        # Do not print response body — may contain tokens or sensitive details.
        die(f"Firebase token refresh HTTP {exc.code} (check PEBBLE_FIREBASE_REFRESH_TOKEN)")
    except urllib.error.URLError as exc:
        die(f"Firebase token refresh network error: {exc.reason!s}")

    id_token = payload.get("id_token")
    if not id_token:
        die("Firebase token refresh returned no id_token")

    new_refresh = payload.get("refresh_token") or refresh
    expires_in = int(payload.get("expires_in", 3600))
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
    user_id = payload.get("user_id")

    stored = {
        "id_token": id_token,
        "refresh_token": new_refresh,
        "expires_at": expires_at,
        "firebase_user_id": user_id,
        "email": None,
        "display_name": None,
        "firebase_project_id": project_id,
        "firebase_api_key": api_key,
        "auth_provider": "firebase",
        "identity_provider": "ci-refresh-token",
    }
    cred_path.write_text(json.dumps(stored), encoding="utf-8")
    # Never print token material — only path + lengths for debugging.
    print(
        "cloudpebble-login: wrote credentials "
        f"(id_token_len={len(id_token)} refresh_token_len={len(new_refresh)}) "
        f"to {cred_path}"
    )


if __name__ == "__main__":
    main()
