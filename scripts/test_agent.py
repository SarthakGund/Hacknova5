from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from dotenv import load_dotenv

# Ensure project root is importable when running as: uv run scripts/test_agent.py
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from agents.disaster_agent import run_disaster_agent


def test_direct(message: str, dry_run: bool, max_iterations: int) -> dict:
    return run_disaster_agent(
        message=message,
        dry_run=dry_run,
        max_iterations=max_iterations,
    )


def test_api(api_url: str, message: str, dry_run: bool, max_iterations: int) -> dict:
    payload = {
        "message": message,
        "dry_run": dry_run,
        "max_iterations": max_iterations,
    }
    body = json.dumps(payload).encode("utf-8")

    req = urllib_request.Request(
        url=f"{api_url.rstrip('/')}/agent/invoke",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib_request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Test disaster agent (Gemini + LangChain)")
    parser.add_argument(
        "--message",
        default="A flood alert came from Street 12. Check rescue and supplies, then propose actions.",
        help="Prompt for the agent",
    )
    parser.set_defaults(dry_run=True)
    parser.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        help="Do not mutate inventory state (default)",
    )
    parser.add_argument(
        "--live",
        dest="dry_run",
        action="store_false",
        help="Allow state-changing tool actions",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=20,
        help="Agent recursion/tool loop limit",
    )
    parser.add_argument(
        "--recursion-limit",
        type=int,
        default=None,
        help="Alias for --max-iterations",
    )
    parser.add_argument(
        "--api-url",
        default="",
        help="If provided, test via API endpoint (e.g. http://localhost:8000)",
    )

    args = parser.parse_args()
    if args.recursion_limit is not None:
        args.max_iterations = args.recursion_limit

    try:
        if args.api_url:
            result = test_api(args.api_url, args.message, args.dry_run, args.max_iterations)
        else:
            result = test_direct(args.message, args.dry_run, args.max_iterations)

        print(json.dumps(result, indent=2, default=str))

    except HTTPError as exc:
        print(f"HTTP error: {exc.code} {exc.reason}")
        if exc.fp:
            print(exc.fp.read().decode("utf-8", errors="ignore"))
    except URLError as exc:
        print(f"Connection error: {exc.reason}")
    except Exception as exc:
        print(f"Test failed: {exc}")


if __name__ == "__main__":
    main()
