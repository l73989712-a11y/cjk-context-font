(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CJKCFSiteAdapters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ADAPTERS = Object.freeze([
    Object.freeze({
      id: "bilibili",
      names: ["bilibili.com", "www.bilibili.com", "t.bilibili.com", "space.bilibili.com"],
      mutationDelayMs: 320,
      characterDebounceMs: 280,
      titleSelectors: [".bili-video-card__info--tit", ".video-title", "h1"],
      commentSelectors: [".reply-content", ".sub-reply-content", ".bili-dyn-content__orig__desc"]
    }),
    Object.freeze({
      id: "youtube",
      suffixes: ["youtube.com", "youtu.be"],
      mutationDelayMs: 210,
      characterDebounceMs: 260,
      titleSelectors: ["#video-title", "h1 yt-formatted-string"],
      commentSelectors: ["#content-text"]
    }),
    Object.freeze({
      id: "chatgpt",
      names: ["chatgpt.com", "chat.openai.com"],
      mutationDelayMs: 220,
      characterDebounceMs: 360,
      titleSelectors: [],
      commentSelectors: ["[data-message-author-role]"]
    }),
    Object.freeze({
      id: "niconico",
      suffixes: ["nicovideo.jp", "nico.ms"],
      mutationDelayMs: 190,
      characterDebounceMs: 240,
      titleSelectors: ["h1"],
      commentSelectors: []
    }),
    Object.freeze({
      id: "wikipedia",
      suffixes: ["wikipedia.org", "wikimedia.org"],
      mutationDelayMs: 110,
      characterDebounceMs: 180,
      titleSelectors: ["h1"],
      commentSelectors: []
    })
  ]);

  const GENERIC = Object.freeze({
    id: "generic",
    mutationDelayMs: 140,
    characterDebounceMs: 220,
    titleSelectors: [],
    commentSelectors: []
  });

  function normalizeHost(value) {
    return String(value ?? "").trim().toLowerCase().replace(/^www\./u, "");
  }

  function matches(adapter, host) {
    const normalized = normalizeHost(host);
    if (adapter.names?.some(name => normalizeHost(name) === normalized)) return true;
    return Boolean(adapter.suffixes?.some(suffix => {
      const normalizedSuffix = normalizeHost(suffix);
      return normalized === normalizedSuffix || normalized.endsWith(`.${normalizedSuffix}`);
    }));
  }

  function resolve(host) {
    return ADAPTERS.find(adapter => matches(adapter, host)) ?? GENERIC;
  }

  function matchesAny(element, selectors) {
    if (!element?.closest || !Array.isArray(selectors)) return false;
    for (const selector of selectors) {
      try {
        if (element.closest(selector)) return true;
      } catch {
        // 声明式站点适配器中的错误选择器不能影响网页。
      }
    }
    return false;
  }

  function roleFor(element, adapter) {
    if (matchesAny(element, adapter?.titleSelectors)) return "title";
    if (matchesAny(element, adapter?.commentSelectors)) return "comment";
    return "other";
  }

  return Object.freeze({ ADAPTERS, GENERIC, resolve, roleFor });
});
