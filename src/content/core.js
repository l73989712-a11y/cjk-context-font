(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CJKCFCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    enabled: true,
    ambiguousHan: "inherit",
    recognitionMode: "balanced",
    observeDynamic: true,
    processOpenShadowRoots: false,
    safeDomMode: true,
    segmentMixedText: false,
    acgTitleHeuristics: true,
    applyLangAttribute: false,
    developerOverlay: false,
    minimumTextLength: 1,
    maximumTextLength: 5000,
    ignoreSelectors:
      '[contenteditable="true"],[contenteditable="plaintext-only"],.CodeMirror,.monaco-editor,.ace_editor',
    jaSans:
      '"Noto Sans JP","Noto Sans CJK JP","Yu Gothic UI","Yu Gothic","Meiryo",sans-serif',
    jaSerif:
      '"Noto Serif JP","Noto Serif CJK JP","Yu Mincho","MS PMincho",serif',
    zhHansSans:
      '"Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif',
    zhHansSerif:
      '"Noto Serif CJK SC","Source Han Serif SC","SimSun",serif',
    zhHantSans:
      '"Microsoft JhengHei UI","Microsoft JhengHei","Noto Sans CJK TC","Source Han Sans TC",sans-serif',
    zhHantSerif:
      '"Noto Serif CJK TC","Source Han Serif TC","PMingLiU",serif',
    koSans:
      '"Noto Sans KR","Noto Sans CJK KR","Malgun Gothic",sans-serif',
    koSerif:
      '"Noto Serif KR","Noto Serif CJK KR","Batang",serif'
  });

  const VALID_LANGUAGES = new Set(["ja", "zh-Hans", "zh-Hant", "ko"]);
  const VALID_RECOGNITION_MODES = new Set(["conservative", "balanced", "aggressive"]);

  const RE = Object.freeze({
    han: /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu,
    kana: /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9D]/gu,
    hangul: /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/gu,
    japaneseMarks: /[々〆ヶヵゝゞヽヾ]/gu,
    cjk: /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9D\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u,
    kanaOne: /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9D]/u,
    hangulOne: /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/u,
    hanOne: /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u,
    latin: /[A-Za-z]/gu,
    digits: /[0-9０-９]/gu
  });

  const SIMPLIFIED_HINTS = new Set(
    [..."这来时会发后里为国学门见说话车东书长万与云电风体边变画听开关问间爱马鱼鸟龙台广汉语无乐气艺叶号实义点当从众优华应进还过达两几区岁归岛织读写买卖让许认总经线级现条办产传专严际观证张陈刘杨赵孙钟吴罗郑龟齐"]
  );
  const TRADITIONAL_HINTS = new Set(
    [..."這來時會發後裡為國學門見說話車東書長萬與雲電風體邊變畫聽開關問間愛馬魚鳥龍臺廣漢語無樂氣藝葉號實義點當從眾優華應進還過達兩幾區歲歸島織讀寫買賣讓許認總經線級現條辦產傳專嚴際觀證張陳劉楊趙孫鐘吳羅鄭龜齊"]
  );
  const JAPANESE_HAN_HINTS = new Set(
    [..."働畑峠辻榊込咲匂塚栃阪枠凪雫匁俣俤躾噺凧凩硲粂麿榎栞"]
  );

  // 在任何语境中都比较有辨识度的日文标题或写法。
  const JAPANESE_STRONG_TITLE_TERMS = [
    "紅蓮華", "呪術廻戦", "進撃", "転生", "機動戦士", "錬金術師", "戦隊",
    "歌姫", "先輩", "後輩", "神様", "王様", "姫様", "異世界"
  ];

  // 这些词在中文里也常见，只有元素明显像标题时才增加较多分数。
  const JAPANESE_WEAK_TITLE_TERMS = [
    "物語", "勇者", "魔王", "学園", "戦記", "残響", "散歌", "日常", "未来日記",
    "約束", "運命", "奇跡", "軌跡", "終末", "革命", "絶望", "楽園", "新世界",
    "青空", "星空", "花火", "幻想", "彼女", "彼氏", "探偵", "君", "僕", "俺"
  ];

  const SIMPLIFIED_CHINESE_PHRASES = [
    "这个", "那个", "这些", "那些", "视频", "评论", "标题", "歌曲", "动画", "漫画",
    "番剧", "喜欢", "觉得", "感觉", "应该", "可以", "没有", "不是", "真的", "非常",
    "还有", "因为", "所以", "但是", "如果", "已经", "时候", "我们", "你们", "他们",
    "怎么", "什么", "为什么", "里面", "一个", "内容", "发布", "作者", "观众", "字幕",
    "日语", "日文", "汉字", "字体", "插件", "网页", "加载", "显示"
  ];

  const TRADITIONAL_CHINESE_PHRASES = [
    "這個", "那個", "這些", "那些", "影片", "評論", "標題", "歌曲", "動畫", "漫畫",
    "喜歡", "覺得", "感覺", "應該", "可以", "沒有", "不是", "真的", "非常", "還有",
    "因為", "所以", "但是", "如果", "已經", "時候", "我們", "你們", "他們", "怎麼",
    "什麼", "為什麼", "裡面", "一個", "內容", "發佈", "作者", "觀眾", "字幕",
    "日語", "日文", "漢字", "字體", "插件", "網頁", "載入", "顯示"
  ];

  const RECOGNITION_PROFILES = Object.freeze({
    conservative: Object.freeze({ scoreThreshold: 3.15, marginThreshold: 1.4, weakTitleWeight: 0.62, mixedKanaLimit: 0.32 }),
    balanced: Object.freeze({ scoreThreshold: 2.45, marginThreshold: 1.0, weakTitleWeight: 1.0, mixedKanaLimit: 0.22 }),
    aggressive: Object.freeze({ scoreThreshold: 1.85, marginThreshold: 0.62, weakTitleWeight: 1.28, mixedKanaLimit: 0.14 })
  });

  function recognitionProfile(mode) {
    return RECOGNITION_PROFILES[VALID_RECOGNITION_MODES.has(mode) ? mode : "balanced"];
  }

  function countMatches(text, regex) {
    return text.match(regex)?.length ?? 0;
  }

  function countSetHints(text, set) {
    let count = 0;
    for (const char of text) if (set.has(char)) count += 1;
    return count;
  }

  function phraseScore(text, phrases, weight) {
    let score = 0;
    for (const phrase of phrases) {
      let index = text.indexOf(phrase);
      while (index !== -1) {
        score += weight + Math.min(1.5, phrase.length * 0.15);
        index = text.indexOf(phrase, index + phrase.length);
      }
    }
    return score;
  }

  function normalizeLanguageTag(tag) {
    if (!tag) return null;
    const value = String(tag).trim().toLowerCase().replace(/_/g, "-");
    if (value === "ja" || value.startsWith("ja-")) return "ja";
    if (value === "ko" || value.startsWith("ko-")) return "ko";
    if (
      value === "zh-hant" || value.startsWith("zh-hant-") ||
      value === "zh-tw" || value.startsWith("zh-tw-") ||
      value === "zh-hk" || value.startsWith("zh-hk-") ||
      value === "zh-mo" || value.startsWith("zh-mo-")
    ) return "zh-Hant";
    if (value === "zh" || value.startsWith("zh-")) return "zh-Hans";
    return null;
  }

  function normalizeDictionaryTerm(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function normalizeHost(value) {
    return String(value ?? "").trim().toLowerCase().replace(/^\.+|\.+$/gu, "");
  }

  function findDictionaryMatch(text, entries = [], host = "") {
    const normalizedText = normalizeDictionaryTerm(text);
    const normalizedHost = normalizeHost(host);
    if (!normalizedText || !Array.isArray(entries)) return null;

    const candidates = [];
    for (const raw of entries) {
      if (!raw || typeof raw !== "object" || !VALID_LANGUAGES.has(raw.language)) continue;
      const term = normalizeDictionaryTerm(raw.term);
      const entryHost = normalizeHost(raw.host);
      const matchMode = raw.matchMode === "contains" ? "contains" : "exact";
      if (!term || term.length > 160) continue;
      if (entryHost && entryHost !== normalizedHost) continue;

      const matched = matchMode === "exact"
        ? normalizedText === term
        : normalizedText.includes(term);
      if (!matched) continue;

      candidates.push({
        ...raw,
        term,
        host: entryHost,
        matchMode,
        _rank: (entryHost ? 100000 : 0) +
          (matchMode === "exact" ? 10000 : 0) +
          term.length * 10 +
          Math.min(999, Math.floor(Number(raw.createdAt ?? 0) / 1000000000))
      });
    }

    candidates.sort((a, b) => b._rank - a._rank);
    const winner = candidates[0];
    if (!winner) return null;
    const { _rank, ...entry } = winner;
    return {
      ...entry,
      reason: winner.matchMode === "exact"
        ? "user-dictionary-exact"
        : "user-dictionary-contains",
      evidence: [
        `dictionary:${winner.matchMode}`,
        winner.host ? "dictionary:site" : "dictionary:global"
      ]
    };
  }

  function analyzeScripts(text) {
    const normalized = normalizeDictionaryTerm(text);
    const kana = countMatches(normalized, RE.kana);
    const hangul = countMatches(normalized, RE.hangul);
    const han = countMatches(normalized, RE.han);
    const japaneseMarks = countMatches(normalized, RE.japaneseMarks);
    const latin = countMatches(normalized, RE.latin);
    const digits = countMatches(normalized, RE.digits);
    const cjkTotal = kana + hangul + han;
    const visibleLength = [...normalized].filter(char => !/\s/u.test(char)).length;
    return Object.freeze({
      normalized,
      visibleLength,
      kana,
      hangul,
      han,
      japaneseMarks,
      latin,
      digits,
      cjkTotal,
      kanaDensity: cjkTotal ? Number((kana / cjkTotal).toFixed(4)) : 0,
      hangulDensity: cjkTotal ? Number((hangul / cjkTotal).toFixed(4)) : 0,
      hanDensity: cjkTotal ? Number((han / cjkTotal).toFixed(4)) : 0,
      simplifiedHints: countSetHints(normalized, SIMPLIFIED_HINTS),
      traditionalHints: countSetHints(normalized, TRADITIONAL_HINTS),
      japaneseHanHints: countSetHints(normalized, JAPANESE_HAN_HINTS)
    });
  }

  function explicitPriority(context) {
    if (VALID_LANGUAGES.has(context.manualLanguage)) {
      return { language: context.manualLanguage, confidence: 1, reason: "manual", evidence: ["manual"], source: "explicit" };
    }
    if (VALID_LANGUAGES.has(context.siteRuleLanguage)) {
      return { language: context.siteRuleLanguage, confidence: 1, reason: "site-rule", evidence: ["site-rule"], source: "explicit" };
    }
    if (VALID_LANGUAGES.has(context.dictionaryLanguage)) {
      return {
        language: context.dictionaryLanguage,
        confidence: 1,
        reason: String(context.dictionaryEvidence?.reason ?? "user-dictionary"),
        evidence: Array.isArray(context.dictionaryEvidence?.evidence)
          ? context.dictionaryEvidence.evidence
          : ["user-dictionary"],
        source: "explicit"
      };
    }
    return null;
  }

  function classifyPureHan(text, context = {}, stats = analyzeScripts(text)) {
    const explicit = explicitPriority(context);
    if (explicit) return explicit;

    const {
      inheritedLanguage = null,
      inheritedDistance = Number.POSITIVE_INFINITY,
      locationLanguage = null,
      siteDefaultLanguage = "auto",
      ambiguousHan = "inherit",
      browserLanguage = null,
      acgTitleHeuristics = true,
      recognitionMode = "balanced",
      titleLikelihood = 0
    } = context;

    if (VALID_LANGUAGES.has(inheritedLanguage) && inheritedDistance <= 1) {
      return { language: inheritedLanguage, confidence: 0.98, reason: "near-lang", evidence: ["near-lang"], source: "markup" };
    }

    const profile = recognitionProfile(recognitionMode);
    const titleWeight = Math.max(0, Math.min(1, Number(titleLikelihood) || 0));
    let jaScore = stats.japaneseHanHints * 4;
    let hansScore = stats.simplifiedHints * 0.78;
    let hantScore = stats.traditionalHints * 0.82;
    const evidence = [];

    if (stats.japaneseHanHints) evidence.push(`japanese-han:${stats.japaneseHanHints}`);
    if (stats.simplifiedHints) evidence.push(`simplified-hints:${stats.simplifiedHints}`);
    if (stats.traditionalHints) evidence.push(`traditional-hints:${stats.traditionalHints}`);

    if (acgTitleHeuristics) {
      const strongJa = phraseScore(text, JAPANESE_STRONG_TITLE_TERMS, 2.2);
      const weakJa = phraseScore(text, JAPANESE_WEAK_TITLE_TERMS, 1.15) *
        profile.weakTitleWeight * titleWeight;
      const hansTerms = phraseScore(text, SIMPLIFIED_CHINESE_PHRASES, 2.2);
      const hantTerms = phraseScore(text, TRADITIONAL_CHINESE_PHRASES, 2.2);
      jaScore += strongJa + weakJa;
      hansScore += hansTerms;
      hantScore += hantTerms;
      if (strongJa) evidence.push("japanese-strong-title-terms");
      if (weakJa) evidence.push(`japanese-title-context:${titleWeight.toFixed(2)}`);
      if (hansTerms) evidence.push("simplified-phrases");
      if (hantTerms) evidence.push("traditional-phrases");
    }

    if (VALID_LANGUAGES.has(inheritedLanguage)) {
      if (inheritedLanguage === "ja") jaScore += 1.2;
      if (inheritedLanguage === "zh-Hans") hansScore += 1.2;
      if (inheritedLanguage === "zh-Hant") hantScore += 1.2;
    }
    if (locationLanguage === "ja") jaScore += 0.8;
    if (locationLanguage === "zh-Hans") hansScore += 0.8;
    if (locationLanguage === "zh-Hant") hantScore += 0.8;

    if (siteDefaultLanguage === "ja") jaScore += 2.1;
    if (siteDefaultLanguage === "zh-Hans") hansScore += 2.1;
    if (siteDefaultLanguage === "zh-Hant") hantScore += 2.1;
    if (siteDefaultLanguage === "ko") {
      return { language: "ko", confidence: 0.65, reason: "site-default", evidence: ["site-default"], source: "fallback" };
    }

    const scores = [
      { language: "ja", score: jaScore },
      { language: "zh-Hans", score: hansScore },
      { language: "zh-Hant", score: hantScore }
    ].sort((a, b) => b.score - a.score);
    const margin = scores[0].score - scores[1].score;
    const scoreObject = Object.fromEntries(scores.map(item => [item.language, Number(item.score.toFixed(3))]));

    if (scores[0].score >= profile.scoreThreshold && margin >= profile.marginThreshold) {
      return {
        language: scores[0].language,
        confidence: Math.min(0.95, 0.5 + scores[0].score * 0.075 + margin * 0.035),
        reason: scores[0].language === "ja" ? "han-title-score" : "han-language-score",
        evidence,
        scores: scoreObject,
        decisionMargin: Number(margin.toFixed(3)),
        recognitionMode: VALID_RECOGNITION_MODES.has(recognitionMode) ? recognitionMode : "balanced",
        source: "automatic"
      };
    }

    if (VALID_LANGUAGES.has(inheritedLanguage)) {
      return { language: inheritedLanguage, confidence: 0.58, reason: "document-lang", evidence: ["document-lang"], scores: scoreObject, decisionMargin: Number(margin.toFixed(3)), source: "fallback" };
    }
    if (VALID_LANGUAGES.has(locationLanguage)) {
      return { language: locationLanguage, confidence: 0.52, reason: "location-prior", evidence: ["location-prior"], scores: scoreObject, decisionMargin: Number(margin.toFixed(3)), source: "fallback" };
    }
    if (siteDefaultLanguage !== "auto" && VALID_LANGUAGES.has(siteDefaultLanguage)) {
      return { language: siteDefaultLanguage, confidence: 0.5, reason: "site-default", evidence: ["site-default"], scores: scoreObject, decisionMargin: Number(margin.toFixed(3)), source: "fallback" };
    }

    switch (ambiguousHan) {
      case "ja": return { language: "ja", confidence: 0.35, reason: "user-default", evidence: ["user-default"], scores: scoreObject, source: "fallback" };
      case "zh-Hans": return { language: "zh-Hans", confidence: 0.35, reason: "user-default", evidence: ["user-default"], scores: scoreObject, source: "fallback" };
      case "zh-Hant": return { language: "zh-Hant", confidence: 0.35, reason: "user-default", evidence: ["user-default"], scores: scoreObject, source: "fallback" };
      case "none": return null;
      case "inherit":
      default:
        return VALID_LANGUAGES.has(browserLanguage)
          ? { language: browserLanguage, confidence: 0.3, reason: "browser-language", evidence: ["browser-language"], scores: scoreObject, source: "fallback" }
          : null;
    }
  }

  function chineseContextScores(text) {
    return {
      hans: phraseScore(text, SIMPLIFIED_CHINESE_PHRASES, 2.2),
      hant: phraseScore(text, TRADITIONAL_CHINESE_PHRASES, 2.2)
    };
  }

  function classifyText(text, context = {}) {
    const trimmed = String(text ?? "").trim();
    const minimumTextLength = Number(context.minimumTextLength ?? DEFAULTS.minimumTextLength);
    const maximumTextLength = Number(context.maximumTextLength ?? DEFAULTS.maximumTextLength);
    if (trimmed.length < minimumTextLength || trimmed.length > maximumTextLength || !RE.cjk.test(trimmed)) {
      return null;
    }

    const explicit = explicitPriority(context);
    if (explicit) return explicit;

    const stats = analyzeScripts(trimmed);
    const profile = recognitionProfile(context.recognitionMode);

    if (stats.hangul > 0 && stats.hangul >= stats.kana) {
      return {
        language: "ko",
        confidence: Math.min(1, 0.92 + stats.hangulDensity * 0.08),
        reason: "hangul",
        evidence: [`hangul:${stats.hangul}`],
        scriptStats: stats,
        source: "script"
      };
    }

    if (stats.kana > 0 || stats.japaneseMarks > 0) {
      const chinese = chineseContextScores(trimmed);
      const chineseLanguage = chinese.hans >= chinese.hant ? "zh-Hans" : "zh-Hant";
      const chineseScore = Math.max(chinese.hans, chinese.hant);
      const clearlyChineseSentence =
        stats.han >= 4 &&
        chineseScore >= 3.0 &&
        stats.kanaDensity < profile.mixedKanaLimit;

      if (clearlyChineseSentence) {
        return {
          language: chineseLanguage,
          confidence: Math.min(0.94, 0.78 + chineseScore * 0.025),
          reason: "mixed-script-chinese-context",
          evidence: [
            `kana:${stats.kana}`,
            `kana-density:${stats.kanaDensity}`,
            chineseLanguage === "zh-Hans" ? "simplified-phrases" : "traditional-phrases"
          ],
          scriptStats: stats,
          source: "automatic"
        };
      }

      return {
        language: "ja",
        confidence: Math.min(1, 0.92 + Math.min(0.08, stats.kanaDensity * 0.12)),
        reason: "kana-or-japanese-mark",
        evidence: [`kana:${stats.kana}`, `marks:${stats.japaneseMarks}`, `kana-density:${stats.kanaDensity}`],
        scriptStats: stats,
        source: "script"
      };
    }

    if (stats.han === 0) return null;
    return classifyPureHan(trimmed, context, stats);
  }

  function analyzeText(text, context = {}) {
    const stats = analyzeScripts(text);
    const result = classifyText(text, context);
    return Object.freeze({
      textLength: String(text ?? "").length,
      recognitionMode: VALID_RECOGNITION_MODES.has(context.recognitionMode)
        ? context.recognitionMode
        : "balanced",
      titleLikelihood: Math.max(0, Math.min(1, Number(context.titleLikelihood) || 0)),
      scripts: stats,
      result
    });
  }

  return Object.freeze({
    DEFAULTS,
    VALID_LANGUAGES,
    VALID_RECOGNITION_MODES,
    RE,
    normalizeLanguageTag,
    normalizeDictionaryTerm,
    findDictionaryMatch,
    analyzeScripts,
    analyzeText,
    recognitionProfile,
    classifyPureHan,
    classifyText,
    _test: Object.freeze({ countMatches, countSetHints, phraseScore, chineseContextScores })
  });
});
