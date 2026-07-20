"use strict";
const { performance } = require("node:perf_hooks");
const Core = require("../src/content/core.js");
const TextEngine = require("../src/content/text-engine.js");
let revision = 1;
const diagnostics = { increment() {}, noteReason() {}, setGauge() {} };
const engine = TextEngine.create({
  Core,
  getContext: () => ({ ambiguousHan: "none", acgTitleHeuristics: true, minimumTextLength: 1, maximumTextLength: 5000 }),
  getRevision: () => revision,
  diagnostics
});
const samples = ["残酷な天使のテーゼ", "这个视频真的很好看", "這部動畫真的很好看", "紅蓮華", "한국어 테스트", "自然"];
function run(iterations) {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) engine.classifyText(samples[i % samples.length], null);
  return performance.now() - start;
}
const coldMs = run(30000);
const warmMs = run(30000);
const stats = engine.stats();
if (stats.hitRate < 0.99) throw new Error(`缓存命中率异常：${stats.hitRate}`);
console.log(JSON.stringify({ iterations: 60000, coldMs: +coldMs.toFixed(2), warmMs: +warmMs.toFixed(2), ...stats }, null, 2));
