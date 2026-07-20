"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../../core.js");

const base = {
  minimumTextLength: 1,
  maximumTextLength: 5000,
  inheritedLanguage: null,
  inheritedDistance: Infinity,
  locationLanguage: null,
  siteDefaultLanguage: "auto",
  ambiguousHan: "none",
  browserLanguage: null,
  acgTitleHeuristics: true
};

function classify(text, context = {}) {
  return Core.classifyText(text, { ...base, ...context });
}

test("平假名和片假名是强日文证据", () => {
  assert.equal(classify("残酷な天使のテーゼ").language, "ja");
  assert.equal(classify("ゲーム").reason, "kana-or-japanese-mark");
});

test("韩文是强证据", () => {
  assert.equal(classify("한국어와 漢字").language, "ko");
});

test("常见简体和繁体评论能够区分", () => {
  assert.equal(classify("这个视频真的很好看").language, "zh-Hans");
  assert.equal(classify("這個影片真的很好看").language, "zh-Hant");
});

test("局部 lang 优先于纯汉字标题启发式", () => {
  assert.equal(classify("紅蓮華", { inheritedLanguage: "zh-Hans", inheritedDistance: 1 }).language, "zh-Hans");
});

test("ACG 纯汉字标题可由词项得分识别", () => {
  const result = classify("紅蓮華");
  assert.equal(result.language, "ja");
  assert.equal(result.reason, "han-title-score");
});

test("手动标记和站点规则具有最高优先级", () => {
  assert.equal(classify("这个视频", { manualLanguage: "ja" }).language, "ja");
  assert.equal(classify("ゲーム", { siteRuleLanguage: "zh-Hans" }).language, "zh-Hans");
});

test("真正歧义的纯汉字在 none 策略下保持不处理", () => {
  assert.equal(classify("自然"), null);
});

test("浏览器语言只作为低置信度回退", () => {
  const result = classify("自然", { ambiguousHan: "inherit", browserLanguage: "zh-Hans" });
  assert.equal(result.language, "zh-Hans");
  assert.equal(result.reason, "browser-language");
});

test("语言标签规范化", () => {
  assert.equal(Core.normalizeLanguageTag("ja-JP"), "ja");
  assert.equal(Core.normalizeLanguageTag("zh_TW"), "zh-Hant");
  assert.equal(Core.normalizeLanguageTag("zh-CN"), "zh-Hans");
});


test("个人词典优先于自动文字系统判断", () => {
  const dictionary = Core.findDictionaryMatch("ゲーム", [
    { term: "ゲーム", language: "zh-Hans", matchMode: "exact", host: "" }
  ], "example.com");
  const result = classify("ゲーム", {
    dictionaryLanguage: dictionary.language,
    dictionaryEvidence: dictionary
  });
  assert.equal(result.language, "zh-Hans");
  assert.equal(result.reason, "user-dictionary-exact");
});

test("站点词典优先于全局词典，完全匹配优先于包含匹配", () => {
  const match = Core.findDictionaryMatch("紅蓮華", [
    { id: "a", term: "紅", language: "zh-Hant", matchMode: "contains", host: "" },
    { id: "b", term: "紅蓮華", language: "ja", matchMode: "exact", host: "example.com" }
  ], "example.com");
  assert.equal(match.id, "b");
  assert.equal(match.language, "ja");
});

test("词典规范化全角与空白", () => {
  assert.equal(Core.normalizeDictionaryTerm("  ＡＢＣ　紅蓮華  "), "ABC 紅蓮華");
});
