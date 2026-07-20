from __future__ import annotations

import contextlib
import http.server
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures"
EXTENSION = ROOT / "dist" / "chromium"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@contextlib.contextmanager
def serve_directory(path: Path):
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(path), **kwargs)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join(timeout=3)


def main() -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True)
    profile = Path(tempfile.mkdtemp(prefix="cjkcf-extension-"))
    try:
        with serve_directory(FIXTURES) as base, sync_playwright() as playwright:
            kwargs = {
                "user_data_dir": str(profile),
                # Extensions are tested in headed Chromium. Linux CI wraps this command in Xvfb.
                "headless": False,
                "args": [
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--no-proxy-server",
                    f"--disable-extensions-except={EXTENSION}",
                    f"--load-extension={EXTENSION}",
                ],
            }
            executable = os.environ.get("CHROMIUM_PATH")
            if executable:
                kwargs["executable_path"] = executable

            context = playwright.chromium.launch_persistent_context(**kwargs)
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(f"{base}/dynamic.html", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_function(
                "document.querySelector('#ja')?.dataset.cjkcfApplied === '1'",
                timeout=15000,
            )
            assert "cjkcf-ja" in (page.locator("#ja").get_attribute("class") or "").split()
            assert page.locator("[data-cjkcf-wrapper='1']").count() == 0
            assert page.locator("#ruby [data-cjkcf-applied='1']").count() == 0
            print("Loaded unpacked extension successfully")
            context.close()
    finally:
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
