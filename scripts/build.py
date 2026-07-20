from pathlib import Path
import json, shutil

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DEST = ROOT / "dist" / "chromium"
if DEST.exists(): shutil.rmtree(DEST)
DEST.mkdir(parents=True)

MAPPING = {
    "manifest.json": "manifest.json",
    "background/background.js": "background.js",
    "content/core.js": "core.js",
    "content/diagnostics.js": "diagnostics.js",
    "content/site-adapters.js": "site-adapters.js",
    "content/text-engine.js": "text-engine.js",
    "content/dev-overlay.js": "dev-overlay.js",
    "content/content.js": "content.js",
    "styles/content.css": "content.css",
    "options/options.html": "options.html",
    "options/options.js": "options.js",
    "popup/popup.html": "popup.html",
    "popup/popup.js": "popup.js",
    "styles/ui.css": "ui.css",
}
for source, target in MAPPING.items():
    path = SRC / source
    if not path.is_file(): raise FileNotFoundError(path)
    shutil.copy2(path, DEST / target)
for name in ["README.md", "PRIVACY.md", "LICENSE"]:
    shutil.copy2(ROOT / name, DEST / name)
manifest = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
print(f"Built Chromium extension {manifest['version']} at {DEST}")
