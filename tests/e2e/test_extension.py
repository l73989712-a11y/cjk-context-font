from __future__ import annotations

import contextlib
import http.server
import json
import os
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures"


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


CHROME_MOCK = r"""
(() => {
  const messageListeners = [];
  const changeListeners = [];
  const syncValues = {
    enabled: true,
    ambiguousHan: "none",
    observeDynamic: true,
    processOpenShadowRoots: false,
    safeDomMode: true,
    segmentMixedText: false,
    acgTitleHeuristics: true,
    applyLangAttribute: false
  };
  const localValues = {
    siteRules: [], siteConfigs: {},
    dictionaryEntries: [
      { id: "dict-1", term: "自然", language: "ja", matchMode: "exact", host: "" }
    ]
  };
  const read = (values, defaults) => ({ ...(defaults || {}), ...values });
  const chromeObject = window.chrome || {};
  chromeObject.runtime = {
    getManifest: () => ({ version: "0.4.0" }),
    onMessage: { addListener: listener => messageListeners.push(listener) },
    sendMessage: async () => ({ ok: true })
  };
  chromeObject.storage = {
    sync: {
      get: async defaults => read(syncValues, defaults),
      set: async next => Object.assign(syncValues, next)
    },
    local: {
      get: async defaults => read(localValues, defaults),
      set: async next => Object.assign(localValues, next)
    },
    onChanged: { addListener: listener => changeListeners.push(listener) }
  };
  window.__sendCJKCFMessage = message => new Promise(resolve => {
    let resolved = false;
    const sendResponse = value => { resolved = true; resolve(value); };
    for (const listener of messageListeners) {
      const asyncResponse = listener(message, {}, sendResponse);
      if (asyncResponse === false && resolved) break;
    }
    setTimeout(() => { if (!resolved) resolve(null); }, 50);
  });
})();
"""


def main() -> None:
    with sync_playwright() as playwright:
        launch_options = {
            "headless": True,
            "args": ["--no-sandbox", "--disable-dev-shm-usage"],
        }
        chromium_path = os.environ.get("CHROMIUM_PATH")
        if chromium_path:
            launch_options["executable_path"] = chromium_path
        browser = playwright.chromium.launch(**launch_options)
        context = browser.new_context(locale="zh-CN")
        page = context.new_page()
        page.set_content((FIXTURES / "dynamic.html").read_text(encoding="utf-8"), wait_until="load")
        page.evaluate(CHROME_MOCK)
        page.add_style_tag(path=str(ROOT / "content.css"))
        page.add_script_tag(path=str(ROOT / "core.js"))
        page.add_script_tag(path=str(ROOT / "diagnostics.js"))
        page.add_script_tag(path=str(ROOT / "content.js"))
        page.wait_for_function("document.querySelector('#ja')?.dataset.cjkcfApplied === '1'", timeout=10000)

        assert "cjkcf-ja" in (page.locator("#ja").get_attribute("class") or "").split()
        assert "cjkcf-zh-hans" in (page.locator("#zh").get_attribute("class") or "").split()
        assert "cjkcf-zh-hant" in (page.locator("#hant").get_attribute("class") or "").split()
        assert page.locator("[data-cjkcf-wrapper='1']").count() == 0
        assert page.locator("#ruby ruby").count() == 0
        assert page.locator("#ruby [data-cjkcf-applied='1']").count() == 0
        assert page.locator("#ruby rt").inner_text() == "game"
        page.evaluate("""() => {
          const p = document.createElement('p');
          p.id = 'dictionary'; p.textContent = '自然';
          document.body.append(p);
        }""")
        page.wait_for_function("document.querySelector('#dictionary')?.dataset.cjkcfReason === 'user-dictionary-exact'", timeout=5000)
        assert "cjkcf-ja" in (page.locator("#dictionary").get_attribute("class") or "").split()

        page.evaluate("addDynamicItems(800)")
        page.wait_for_function(
            "document.querySelectorAll('#dynamic p[data-cjkcf-applied=\"1\"]').length >= 790",
            timeout=10000,
        )
        assert page.locator("[data-cjkcf-wrapper='1']").count() == 0

        diagnostics = page.evaluate("__sendCJKCFMessage({type:'CJKCF_GET_DIAGNOSTICS'})")
        assert diagnostics["ok"] is True
        assert diagnostics["diagnostics"]["generatedWrappers"] == 0
        assert diagnostics["diagnostics"]["counters"]["textNodesProcessed"] >= 800

        page.evaluate("document.querySelector('#dynamic').replaceChildren()")
        page.wait_for_timeout(300)
        assert page.locator("#dynamic").count() == 1
        print(json.dumps({
            "ok": True,
            "dynamicItems": 800,
            "wrappers": diagnostics["diagnostics"]["generatedWrappers"],
            "processed": diagnostics["diagnostics"]["counters"]["textNodesProcessed"],
        }, ensure_ascii=False))
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
