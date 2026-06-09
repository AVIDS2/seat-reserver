from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from tools.binding_discovery.capture_utils import sanitize_record, should_block_url, should_capture_url


DEFAULT_START_URL = "http://202.195.100.14/libseat/"
DEFAULT_OUTPUT_DIR = Path("tools/binding_discovery/captures")


async def capture_web(start_url: str, output: Path, headed: bool) -> Path:
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise RuntimeError("缺少 Playwright：请先执行 `python -m pip install playwright` 和 `python -m playwright install chromium`") from exc

    output.parent.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not headed)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()

        async def route_handler(route):
            request = route.request
            if should_block_url(request.url):
                records.append(
                    sanitize_record(
                        {
                            "blocked": True,
                            "method": request.method,
                            "url": request.url,
                            "reason": "freeBook is blocked by binding discovery",
                        }
                    )
                )
                await route.abort()
                return
            await route.continue_()

        await context.route("**/*", route_handler)

        async def response_handler(response):
            request = response.request
            if not should_capture_url(response.url):
                return

            body = ""
            content_type = response.headers.get("content-type", "")
            if "json" in content_type or "text" in content_type or "javascript" in content_type:
                try:
                    body = await response.text()
                except Exception:
                    body = "<unreadable>"

            records.append(
                sanitize_record(
                    {
                        "ts": int(time.time() * 1000),
                        "method": request.method,
                        "url": response.url,
                        "request": {
                            "headers": await request.all_headers(),
                            "post_data": request.post_data or "",
                        },
                        "response": {
                            "status": response.status,
                            "headers": response.headers,
                            "body": body,
                        },
                    }
                )
            )

        page.on("response", response_handler)
        await page.goto(start_url, wait_until="domcontentloaded")

        print("浏览器已打开。请只完成登录/绑定/进入系统流程，不要点击预约提交。")
        print("完成后回到终端按 Enter 保存捕获结果。")
        await asyncio.to_thread(input)

        output.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
        await browser.close()

    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture web login/binding traffic without booking.")
    parser.add_argument("--start-url", default=DEFAULT_START_URL, help=f"Default: {DEFAULT_START_URL}")
    parser.add_argument("--output", type=Path, default=None, help="Output capture JSON path.")
    parser.add_argument("--headless", action="store_true", help="Run browser headless. Default is headed.")
    args = parser.parse_args()

    output = args.output or DEFAULT_OUTPUT_DIR / f"capture-{time.strftime('%Y%m%d-%H%M%S')}.json"
    saved = asyncio.run(capture_web(args.start_url, output, headed=not args.headless))
    print(f"已保存脱敏捕获文件：{saved}")
    print(f"下一步：python tools/binding_discovery/analyze_capture.py {saved}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
