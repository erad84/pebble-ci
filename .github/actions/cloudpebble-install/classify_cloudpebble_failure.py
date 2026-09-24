#!/usr/bin/env python3
"""Classify pebble install --cloudpebble failures for Actions annotations + summary."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path


# (pattern, code, title, guidance) — first match wins.
RULES: list[tuple[re.Pattern[str], str, str, str]] = [
    (
        re.compile(r"must be logged in|Not logged in|Firebase login status: logged out", re.I),
        "not_logged_in",
        "Not logged in to CloudPebble",
        "Firebase credentials are missing or invalid. Re-check "
        "`PEBBLE_FIREBASE_REFRESH_TOKEN` on the *caller* repo (after a local "
        "`pebble login`), then re-run.",
    ),
    (
        re.compile(r"token refresh HTTP 400|token refresh HTTP 401|token refresh HTTP 403", re.I),
        "bad_refresh_token",
        "Firebase refresh token rejected",
        "The refresh token was rejected by Google Identity Toolkit. Create a "
        "fresh token via local `pebble login`, update "
        "`PEBBLE_FIREBASE_REFRESH_TOKEN`, and re-run. Wrong account tokens also "
        "fail here.",
    ),
    (
        re.compile(r"Failed to authenticate to the CloudPebble proxy", re.I),
        "proxy_auth_failed",
        "CloudPebble proxy authentication failed",
        "Logged in, but the CloudPebble proxy rejected the token. Confirm the "
        "token belongs to the Rebble/CloudPebble account linked to the phone "
        "app (wrong account is the usual cause).",
    ),
    (
        re.compile(
            r"Unexpected message when waiting for phone|"
            r"CloudPebble connection status packet: (?!.*Connected)",
            re.I,
        ),
        "phone_offline",
        "Phone did not connect via CloudPebble",
        "Phone looks offline to CloudPebble. Open the Pebble/Rebble app on the "
        "phone, confirm internet + Bluetooth to the watch, and keep the app "
        "in the foreground while CI installs.",
    ),
    (
        # Fallback when the log stopped during the phone wait (job killed / hang).
        re.compile(r"Waiting for phone to connect", re.I),
        "phone_offline",
        "Phone did not connect via CloudPebble",
        "Phone looks offline to CloudPebble. Open the Pebble/Rebble app on the "
        "phone, confirm internet + Bluetooth to the watch, and keep the app "
        "in the foreground while CI installs.",
    ),
    (
        re.compile(r"Timed out waiting for install confirmation", re.I),
        "install_timeout",
        "Install timed out waiting for the watch",
        "Phone connected but the watch did not confirm the install. Enable "
        "Developer Mode / Developer Connection on the watch, keep it nearby "
        "and unlocked, then re-run.",
    ),
    (
        re.compile(r"App install failed", re.I),
        "install_rejected",
        "Watch rejected the install",
        "CloudPebble reached the watch but install failed. Check platform "
        "support in the `.pbw`, free storage, and that Developer Mode is on.",
    ),
    (
        re.compile(
            r"Name or service not known|Temporary failure in name resolution|"
            r"Failed to establish a new connection|Connection refused|"
            r"Network is unreachable|cloudpebble-proxy|WebSocket.*error|"
            r"Handshake status",
            re.I,
        ),
        "cloudpebble_unreachable",
        "CloudPebble unreachable",
        "Could not reach the CloudPebble proxy or Firebase endpoints from the "
        "runner. Retry later; if it persists, check Rebble/CloudPebble status.",
    ),
    (
        re.compile(r"DEVELOPER_NOT_LINKED|Developer link: not linked", re.I),
        "developer_not_linked",
        "Developer account not linked",
        "Firebase login works but the developer profile is not linked. Finish "
        "developer linking in the Rebble/appstore dashboard, then refresh the "
        "token with local `pebble login`.",
    ),
]


def emit_annotation(level: str, title: str, message: str) -> None:
    # Actions annotation format; keep message single-line.
    safe_title = title.replace("%", "%25").replace("\r", "").replace("\n", " ")
    safe_msg = message.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    print(f"::{level} title={safe_title}::{safe_msg}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", required=True, help="Path to captured install log")
    parser.add_argument("--exit-code", type=int, required=True)
    args = parser.parse_args()

    log_path = Path(args.log)
    text = log_path.read_text(encoding="utf-8", errors="replace") if log_path.is_file() else ""

    code, title, guidance = (
        "unknown_failure",
        "CloudPebble install failed",
        "Install failed without a recognized error pattern. Open the job log "
        "for `pebble install --cloudpebble` output (secrets are never printed).",
    )
    for pattern, rule_code, rule_title, rule_guidance in RULES:
        if pattern.search(text):
            code, title, guidance = rule_code, rule_title, rule_guidance
            break

    if args.exit_code == 0:
        code, title, guidance = (
            "success",
            "CloudPebble install succeeded",
            "App install succeeded via CloudPebble.",
        )
        emit_annotation("notice", title, guidance)
    else:
        emit_annotation("error", title, guidance)

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    lines = [
        f"## CloudPebble install: `{code}`",
        "",
        f"**{title}**",
        "",
        guidance,
        "",
        f"- Exit code: `{args.exit_code}`",
        f"- Classifier code: `{code}`",
        "",
    ]
    if args.exit_code != 0 and text.strip():
        # Include a short, non-secret tail of the log for Actions UI.
        tail = "\n".join(text.strip().splitlines()[-40:])
        # Belt-and-suspenders redaction for JWT-like blobs / refresh tokens.
        tail = re.sub(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "[redacted-jwt]", tail)
        tail = re.sub(r"(refresh[_-]?token[\"'\\s:=]+)(\\S+)", r"\1[redacted]", tail, flags=re.I)
        lines.extend(["### Log tail", "", "```text", tail, "```", ""])

    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
    else:
        print("\n".join(lines))

    raise SystemExit(0 if args.exit_code == 0 else 1)


if __name__ == "__main__":
    main()
