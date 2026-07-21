"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../../src/content/core.js");
const TextEngine = require("../../src/content/text-engine.js");
test("bounded cache returns stable classifications", () => {
  let revision = 1;
  const engine = TextEngine.create({
    Core,
    getContext: () => ({ ambiguousHan: "none", acgTitleHeuristics: true, recognitionMode: "balanced", titleLikelihood: 0, minimumTextLength: 1, maximumTextLength: 5000 }),
    getRevision: () => revision,
    maxCacheEntries: 4
  });
  const first = engine.classifyText("残酷な天使のテーゼ", null);
  const second = engine.classifyText("残酷な天使のテーゼ", null);
  assert.equal(first.language, "ja");
  assert.equal(first, second);
  assert.ok(engine.stats().hitRate > 0);
  revision += 1;
  const third = engine.classifyText("残酷な天使のテーゼ", null);
  assert.notEqual(third, second);
});
