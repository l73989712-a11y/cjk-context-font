(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CJKCFTextEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CHINESE_PREFIX_CUES = [
    "我喜欢", "我喜歡", "我爱", "我愛", "喜欢", "喜歡", "推荐", "推薦", "这是", "這是", "这个", "這個",
    "那是", "叫做", "名为", "名為", "歌曲", "标题", "標題", "动画", "動畫", "动漫",
    "番剧", "番劇", "听了", "聽了", "看了", "评论", "評論", "觉得", "覺得", "感觉",
    "感覺", "认为", "認為", "比如", "例如", "以及", "还有", "還有"
  ];

  const CHINESE_SUFFIX_CUES = [
    "很好", "真好", "不错", "不錯", "好看", "好听", "好聽", "太棒", "这首", "這首",
    "这个", "這個", "那个", "那個", "让我", "讓我", "我觉得", "我覺得", "感觉", "感覺",
    "应该", "應該", "比较", "比較", "非常", "真的", "还有", "還有", "但是", "因为",
    "因為", "所以", "了吗", "了嗎"
  ];

  function stableContextKey(context) {
    const dictionary = context.dictionaryEvidence ?? {};
    return [
      context.manualLanguage, context.siteRuleLanguage, context.dictionaryLanguage,
      dictionary.id, dictionary.term, dictionary.host, dictionary.matchMode,
      context.inheritedLanguage, context.inheritedDistance,
      context.locationLanguage, context.siteDefaultLanguage,
      context.ambiguousHan, context.browserLanguage,
      context.acgTitleHeuristics, context.recognitionMode,
      context.titleLikelihood, context.textRole,
      context.minimumTextLength, context.maximumTextLength
    ].map(value => String(value ?? "")).join("\u001f");
  }

  function freezeResult(result) {
    if (!result) return null;
    const evidence = Array.isArray(result.evidence)
      ? Object.freeze([...result.evidence])
      : Object.freeze([]);
    const scores = result.scores && typeof result.scores === "object"
      ? Object.freeze({ ...result.scores })
      : undefined;
    return Object.freeze({ ...result, evidence, ...(scores ? { scores } : {}) });
  }

  function create({
    Core,
    getContext,
    getRevision = () => 0,
    segmentationEnabled = () => false,
    diagnostics = null,
    maxCacheEntries = 2048,
    maxCacheTextLength = 640
  }) {
    if (!Core || typeof getContext !== "function") {
      throw new TypeError("TextEngine requires Core and getContext");
    }
    const { RE } = Core;
    const cache = new Map();
    let hits = 0;
    let misses = 0;
    let evictions = 0;

    function cacheGet(key) {
      if (!cache.has(key)) return undefined;
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      hits += 1;
      diagnostics?.increment("classificationCacheHits");
      return value;
    }

    function cacheSet(key, value) {
      cache.set(key, value);
      while (cache.size > maxCacheEntries) {
        cache.delete(cache.keys().next().value);
        evictions += 1;
        diagnostics?.increment("classificationCacheEvictions");
      }
      diagnostics?.setGauge("classificationCacheSize", cache.size);
    }

    function classifyText(text, parentElement) {
      const context = getContext(text, parentElement);
      const value = String(text ?? "");
      const cacheable = value.length <= maxCacheTextLength;
      const key = cacheable
        ? `${getRevision()}\u001e${stableContextKey(context)}\u001e${value}`
        : null;
      if (key) {
        const cached = cacheGet(key);
        if (cached !== undefined) {
          if (cached) diagnostics?.noteReason(cached.reason);
          return cached;
        }
      }

      misses += 1;
      diagnostics?.increment("classificationCacheMisses");
      const result = freezeResult(Core.classifyText(value, context));
      if (result) diagnostics?.noteReason(result.reason);
      if (key) cacheSet(key, result);
      return result;
    }

    function characterKind(char) {
      if (RE.kanaOne.test(char) || /[ー・々〆ヶヵゝゞヽヾ]/u.test(char)) return "kana";
      if (RE.hangulOne.test(char)) return "hangul";
      if (RE.hanOne.test(char)) return "han";
      return "other";
    }

    function groupByCharacterKind(text) {
      const groups = [];
      for (const char of text) {
        const kind = characterKind(char);
        const last = groups.at(-1);
        if (last?.kind === kind) last.text += char;
        else groups.push({ kind, text: char });
      }
      return groups;
    }

    function longestChinesePrefixBoundary(text) {
      let boundary = -1;
      for (const cue of CHINESE_PREFIX_CUES) {
        const index = text.lastIndexOf(cue);
        if (index !== -1) boundary = Math.max(boundary, index + cue.length);
      }
      return boundary;
    }

    function earliestChineseSuffixBoundary(text) {
      let boundary = -1;
      for (const cue of CHINESE_SUFFIX_CUES) {
        const index = text.indexOf(cue);
        if (index !== -1 && (boundary === -1 || index < boundary)) boundary = index;
      }
      return boundary;
    }

    function splitKanaMixedToken(token, parentElement) {
      const groups = groupByCharacterKind(token);
      const firstKanaGroup = groups.findIndex(group => group.kind === "kana");
      if (firstKanaGroup === -1) {
        return [{ text: token, result: classifyText(token, parentElement) }];
      }

      let startOffset = groups.slice(0, firstKanaGroup)
        .reduce((sum, group) => sum + group.text.length, 0);

      if (firstKanaGroup > 0 && groups[firstKanaGroup - 1].kind === "han") {
        const precedingHan = groups[firstKanaGroup - 1].text;
        const boundary = longestChinesePrefixBoundary(precedingHan);
        const attachedLength = boundary >= 0
          ? precedingHan.length - boundary
          : Math.min(3, precedingHan.length);
        startOffset -= attachedLength;
      }

      let endOffset = token.length;
      let cursor = 0;
      let sawKana = false;
      for (const group of groups) {
        const groupStart = cursor;
        const groupEnd = cursor + group.text.length;
        cursor = groupEnd;
        if (group.kind === "kana") sawKana = true;
        if (!sawKana || group.kind !== "han") continue;
        const boundary = earliestChineseSuffixBoundary(group.text);
        if (boundary !== -1) {
          endOffset = groupStart + boundary;
          break;
        }
      }

      if (startOffset >= endOffset) {
        return [{ text: token, result: classifyText(token, parentElement) }];
      }

      const pieces = [];
      const prefix = token.slice(0, startOffset);
      const japanese = token.slice(startOffset, endOffset);
      const suffix = token.slice(endOffset);
      if (prefix) pieces.push({ text: prefix, result: classifyText(prefix, parentElement) });
      pieces.push({
        text: japanese,
        result: freezeResult({ language: "ja", confidence: 0.98, reason: "mixed-kana-run", evidence: ["mixed-kana-run"] })
      });
      if (suffix) pieces.push({ text: suffix, result: classifyText(suffix, parentElement) });
      return pieces;
    }

    function splitUnquotedText(text, parentElement) {
      const parts = text.split(/([\s，。！？；：、,.!?;:]+)/u);
      const segments = [];
      for (const part of parts) {
        if (!part) continue;
        if (!RE.cjk.test(part)) {
          segments.push({ text: part, result: null });
        } else if (RE.kanaOne.test(part) && RE.hanOne.test(part)) {
          segments.push(...splitKanaMixedToken(part, parentElement));
        } else {
          segments.push({ text: part, result: classifyText(part, parentElement) });
        }
      }
      return segments;
    }

    function quoteRanges(text) {
      const patterns = [
        /《[^《》]{1,160}》/gu, /〈[^〈〉]{1,160}〉/gu,
        /「[^「」]{1,160}」/gu, /『[^『』]{1,160}』/gu,
        /【[^【】]{1,160}】/gu, /“[^“”]{1,160}”/gu,
        /‘[^‘’]{1,160}’/gu
      ];
      const ranges = [];
      for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
          ranges.push({ start: match.index, end: match.index + match[0].length });
        }
      }
      ranges.sort((a, b) => a.start - b.start || b.end - a.end);
      const nonOverlapping = [];
      for (const range of ranges) {
        if (!nonOverlapping.some(item => range.start < item.end && range.end > item.start)) {
          nonOverlapping.push(range);
        }
      }
      return nonOverlapping.sort((a, b) => a.start - b.start);
    }

    function mergeSegments(segments) {
      const merged = [];
      for (const segment of segments) {
        if (!segment.text) continue;
        const previous = merged.at(-1);
        const previousLanguage = previous?.result?.language ?? null;
        const language = segment.result?.language ?? null;
        if (previous && previousLanguage === language) previous.text += segment.text;
        else merged.push({ ...segment });
      }
      return merged;
    }

    function segmentText(text, parentElement) {
      if (!segmentationEnabled() || text.length > 800) {
        return [{ text, result: classifyText(text, parentElement) }];
      }
      const ranges = quoteRanges(text);
      if (ranges.length === 0) return mergeSegments(splitUnquotedText(text, parentElement));
      const segments = [];
      let cursor = 0;
      for (const range of ranges) {
        if (range.start > cursor) {
          segments.push(...splitUnquotedText(text.slice(cursor, range.start), parentElement));
        }
        const quoted = text.slice(range.start, range.end);
        segments.push({ text: quoted, result: classifyText(quoted, parentElement) });
        cursor = range.end;
      }
      if (cursor < text.length) segments.push(...splitUnquotedText(text.slice(cursor), parentElement));
      return mergeSegments(segments);
    }

    function clearCache() {
      cache.clear();
      diagnostics?.setGauge("classificationCacheSize", 0);
    }

    function stats() {
      const total = hits + misses;
      return Object.freeze({
        size: cache.size,
        maxSize: maxCacheEntries,
        hits,
        misses,
        evictions,
        hitRate: total ? Number((hits / total).toFixed(4)) : 0
      });
    }

    return Object.freeze({ classifyText, segmentText, clearCache, stats });
  }

  return Object.freeze({ create });
});
