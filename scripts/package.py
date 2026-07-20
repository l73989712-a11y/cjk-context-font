from pathlib import Path
import json, shutil, subprocess, sys, zipfile

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True)
manifest = json.loads((ROOT / "src" / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
DIST = ROOT / "dist"
RUNTIME = DIST / "chromium"

runtime_zip = DIST / f"cjk-context-font-{version}-chromium.zip"
if runtime_zip.exists(): runtime_zip.unlink()
with zipfile.ZipFile(runtime_zip, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(RUNTIME.rglob("*")):
        if path.is_file(): archive.write(path, path.relative_to(RUNTIME))

source_zip = DIST / f"cjk-context-font-{version}-source.zip"
if source_zip.exists(): source_zip.unlink()
exclude_parts = {".git", ".tmp-playwright-profile", "__pycache__", "dist", "node_modules"}
with zipfile.ZipFile(source_zip, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or any(part in exclude_parts for part in path.relative_to(ROOT).parts):
            continue
        archive.write(path, Path(ROOT.name) / path.relative_to(ROOT))

convenience = ROOT.parent / f"cjk-context-font-{version}.zip"
source_convenience = ROOT.parent / f"cjk-context-font-{version}-source.zip"
shutil.copy2(runtime_zip, convenience)
shutil.copy2(source_zip, source_convenience)
print(runtime_zip); print(source_zip); print(convenience); print(source_convenience)
