"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const Core = require("../../src/content/core.js");
const corpus = JSON.parse(readFileSync(join(__dirname, "../fixtures/corpus.json"), "utf8"));
const base = {
  minimumTextLength: 1, maximumTextLength: 5000,
  inheritedLanguage: null, inheritedDistance: Infinity,
  locationLanguage: null, siteDefaultLanguage: "auto",
  ambiguousHan: "none", browserLanguage: null,
  acgTitleHeuristics: true, recognitionMode: "balanced", titleLikelihood: 0
};
test("黄金语料保持预期分类", () => {
  const failures = [];
  for (const item of corpus) {
    const actual = Core.classifyText(item.text, base)?.language ?? null;
    if (actual !== item.expected) failures.push({ ...item, actual });
  }
  assert.deepEqual(failures, []);
});
