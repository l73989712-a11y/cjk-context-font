from pathlib import Path
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
DIST = ROOT / "dist"
DIST.mkdir(exist_ok=True)

runtime_files = [
    "manifest.json", "background.js", "core.js", "diagnostics.js", "content.js",
    "content.css", "options.html", "options.js", "popup.html", "popup.js", "ui.css",
    "README.md", "PRIVACY.md", "LICENSE"
]

runtime_zip = DIST / f"cjk-context-font-{version}-chromium.zip"
if runtime_zip.exists():
    runtime_zip.unlink()
with zipfile.ZipFile(runtime_zip, "w", zipfile.ZIP_DEFLATED) as archive:
    for relative in runtime_files:
        path = ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(path)
        # Chrome Web Store / sideload ZIP: manifest must be at archive root.
        archive.write(path, relative)

source_zip = DIST / f"cjk-context-font-{version}-source.zip"
if source_zip.exists():
    source_zip.unlink()
exclude_parts = {".git", ".tmp-playwright-profile", "__pycache__", "dist", "node_modules"}
with zipfile.ZipFile(source_zip, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or any(part in exclude_parts for part in path.relative_to(ROOT).parts):
            continue
        archive.write(path, Path(ROOT.name) / path.relative_to(ROOT))

# Convenience copy for the current conversation.
convenience = ROOT.parent / f"cjk-context-font-{version}.zip"
shutil.copy2(runtime_zip, convenience)
print(runtime_zip)
print(source_zip)
print(convenience)
