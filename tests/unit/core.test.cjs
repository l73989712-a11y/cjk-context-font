"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../../src/content/core.js");

const base = {
  minimumTextLength: 1,
  maximumTextLength: 5000,
  inheritedLanguage: null,
  inheritedDistance: Infinity,
  locationLanguage: null,
  siteDefaultLanguage: "auto",
  ambiguousHan: "none",
  browserLanguage: null,
  acgTitleHeuristics: true,
  recognitionMode: "balanced",
  titleLikelihood: 0
};

function classify(text, context = {}) {
  return Core.classifyText(text, { ...base, ...context });
}

test("平假名和片假名是强日文证据", () => {
  assert.equal(classify("残酷な天使のテーゼ").language, "ja");
  assert.equal(classify("ゲーム").reason, "kana-or-japanese-mark");
});

test("中文句子中的少量片假名不会把整句强制判为日文", () => {
  const result = classify("这个视频里的ゲーム翻译得很好");
  assert.equal(result.language, "zh-Hans");
  assert.equal(result.reason, "mixed-script-chinese-context");
});

test("短日文标题仍由假名判定为日文", () => {
  assert.equal(classify("君の名は很好看").language, "ja");
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

test("强辨识度 ACG 纯汉字标题可自动识别", () => {
  const result = classify("紅蓮華");
  assert.equal(result.language, "ja");
  assert.equal(result.reason, "han-title-score");
});

test("宽泛标题词只在标题语境中明显增加分数", () => {
  assert.equal(classify("新世界", { titleLikelihood: 0 }), null);
  const title = classify("新世界", { titleLikelihood: 1, recognitionMode: "aggressive" });
  assert.equal(title.language, "ja");
});

test("保守模式比积极模式更少处理纯汉字", () => {
  const conservative = classify("物語", { titleLikelihood: 1, recognitionMode: "conservative" });
  const aggressive = classify("物語", { titleLikelihood: 1, recognitionMode: "aggressive" });
  assert.equal(conservative, null);
  assert.equal(aggressive.language, "ja");
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

test("分析接口返回文字系统密度和决策解释", () => {
  const analysis = Core.analyzeText("这个视频里的ゲーム翻译得很好", base);
  assert.ok(analysis.scripts.kana > 0);
  assert.ok(analysis.scripts.han > 0);
  assert.equal(analysis.result.reason, "mixed-script-chinese-context");
});
