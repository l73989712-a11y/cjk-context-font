import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const core = readFileSync("core.js", "utf8");
const content = readFileSync("content.js", "utf8");
const defaultsMatch = core.match(/const DEFAULTS = Object\.freeze\(\{([\s\S]*?)\n  \}\);/u);
if (!defaultsMatch) throw new Error("无法读取 DEFAULTS");
const defaults = defaultsMatch[1];
for (const expected of [
  "safeDomMode: true",
  "segmentMixedText: false",
  "processOpenShadowRoots: false",
  "applyLangAttribute: false"
]) {
  if (!defaults.includes(expected)) throw new Error(`危险默认值检查失败：${expected}`);
}
if (!content.includes('"RUBY", "RT", "RP"')) throw new Error("ruby 保护缺失");
if (!content.includes('[data-kt-generated="true"]')) throw new Error("片假名脚本保护缺失");
if (manifest.content_scripts?.[0]?.all_frames !== false) throw new Error("all_frames 必须保持 false");
console.log(`Release safety checks passed for ${manifest.version}`);
