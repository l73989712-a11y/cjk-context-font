import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const files = ["core.js", "diagnostics.js", "content.js", "background.js", "options.js", "popup.js"];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
}
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (manifest.manifest_version !== 3) throw new Error("manifest_version 必须为 3");
if (manifest.version !== pkg.version) throw new Error("manifest 与 package.json 版本号不一致");
for (const path of ["README.md", "LICENSE", "PRIVACY.md", "SECURITY.md", "CONTRIBUTING.md"]) {
  if (!existsSync(path)) throw new Error(`缺少发布文件：${path}`);
}
console.log(`Checked ${files.length} JavaScript files; version ${manifest.version}`);
