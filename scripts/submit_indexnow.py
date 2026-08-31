#!/usr/bin/env python3
"""Submit changed andreabor.io URLs to the public IndexNow endpoint."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


HOST = "andreabor.io"
KEY = "6d0d847aed1344d1aa1ba106c889011a"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/IndexNow"


def canonical_url(value: str) -> str:
    if value.startswith("/"):
        value = f"https://{HOST}{value}"

    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "https" or parsed.hostname != HOST:
        raise ValueError(f"URL must use https://{HOST}: {value}")
    if parsed.username or parsed.password or parsed.port:
        raise ValueError(f"URL may not contain credentials or a port: {value}")

    path = parsed.path or "/"
    return urllib.parse.urlunsplit(("https", HOST, path, parsed.query, ""))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("urls", nargs="+", help="Canonical URLs or absolute paths")
    parser.add_argument("--dry-run", action="store_true", help="Print the payload without submitting it")
    args = parser.parse_args()

    try:
        urls = list(dict.fromkeys(canonical_url(value) for value in args.urls))
    except ValueError as error:
        parser.error(str(error))

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }
    body = json.dumps(payload, indent=2).encode("utf-8")

    if args.dry_run:
        print(body.decode("utf-8"))
        return 0

    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "andreabor.io-indexnow/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            print(f"IndexNow accepted {len(urls)} URL(s): HTTP {response.status}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace").strip()
        print(f"IndexNow rejected the request: HTTP {error.code} {detail}", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"IndexNow request failed: {error.reason}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
