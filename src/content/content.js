(() => {
  "use strict";

  const Core = globalThis.CJKCFCore;
  const Diagnostics = globalThis.CJKCFDiagnostics;
  const SiteAdapters = globalThis.CJKCFSiteAdapters;
  const TextEngine = globalThis.CJKCFTextEngine;
  const DevOverlay = globalThis.CJKCFDevOverlay;
  if (!Core || !Diagnostics || !SiteAdapters || !TextEngine || !DevOverlay) {
    throw new Error("CJK Context Font 核心模块未完整加载。");
  }

  const { DEFAULTS, VALID_LANGUAGES, RE, normalizeLanguageTag } = Core;

  const LANGUAGE_CLASSES = [
    "cjkcf-ja",
    "cjkcf-zh-hans",
    "cjkcf-zh-hant",
    "cjkcf-ko"
  ];

  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION",
    "CODE", "PRE", "KBD", "SAMP", "SVG", "MATH", "CANVAS", "IFRAME",
    "OBJECT", "EMBED", "RUBY", "RT", "RP", "TEMPLATE"
  ]);


  let settings = { ...DEFAULTS };
  let siteRules = [];
  let dictionaryEntries = [];
  let siteConfig = { enabled: true, defaultLanguage: "auto" };
  let classificationRevision = 0;
  const adapter = SiteAdapters.resolve(location.hostname);
  let observer = null;
  let lastContextTarget = null;
  const observedRoots = new WeakSet();
  let serifCache = new WeakMap();
  const characterTimers = new WeakMap();
  const mutationRoots = new Set();
  let mutationFlushTimer = null;
  const scanQueue = [];
  let scanQueueHead = 0;
  const MAX_SCAN_QUEUE = 2000;
  const MAX_SHADOW_SCAN_ELEMENTS = 2500;
  const queued = new WeakSet();
  let scanScheduled = false;
  let cleaning = false;
  const diagnostics = Diagnostics.create({
    version: chrome.runtime.getManifest().version,
    host: location.hostname.toLowerCase()
  });
  diagnostics.setMetadata("adapter", adapter.id);

  function manualLanguageForElement(element) {
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const language = current.dataset?.cjkcfManualLanguage;
      if (VALID_LANGUAGES.has(language)) return language;
      current = current.parentElement;
    }
    return null;
  }

  function matchingSiteRule(element) {
    for (let index = siteRules.length - 1; index >= 0; index -= 1) {
      const rule = siteRules[index];
      try {
        if (element.closest(rule.selector)) return rule;
      } catch {
        // 无效规则会在设置页中保留，方便用户查看和删除，但不会影响页面。
      }
    }
    return null;
  }

  function nearestLanguage(element) {
    let current = element;
    let distance = 0;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (
        current.hasAttribute("lang") &&
        current.dataset.cjkcfAddedLang !== "1"
      ) {
        const language = normalizeLanguageTag(current.getAttribute("lang"));
        if (language) return { language, distance };
      }
      current = current.parentElement;
      distance += 1;
    }

    const documentLanguage = normalizeLanguageTag(document.documentElement.lang);
    return documentLanguage
      ? { language: documentLanguage, distance: Number.POSITIVE_INFINITY }
      : null;
  }

  function languageFromLocation() {
    const host = location.hostname.toLowerCase();
    const path = location.pathname.toLowerCase();

    if (host.endsWith(".jp") || /(^|\/)(ja|ja-jp)(\/|$)/.test(path)) return "ja";
    if (host.endsWith(".kr") || /(^|\/)(ko|ko-kr)(\/|$)/.test(path)) return "ko";
    if (
      host.endsWith(".tw") || host.endsWith(".hk") || host.endsWith(".mo") ||
      /(^|\/)(zh-tw|zh-hk|zh-hant)(\/|$)/.test(path)
    ) return "zh-Hant";
    if (
      host.endsWith(".cn") || host.endsWith(".sg") ||
      /(^|\/)(zh-cn|zh-sg|zh-hans)(\/|$)/.test(path)
    ) return "zh-Hans";

    return null;
  }

  function browserLanguageFallback() {
    const browserLanguages = navigator.languages ?? [navigator.language];
    for (const tag of browserLanguages) {
      const language = normalizeLanguageTag(tag);
      if (language) return language;
    }
    return null;
  }

  function textRoleForElement(element) {
    const adapterRole = SiteAdapters.roleFor(element, adapter);
    if (adapterRole !== "other") return adapterRole;
    if (element?.closest?.('h1,h2,h3,h4,h5,h6,[role="heading"]')) return "title";
    const identity = `${element?.id ?? ""} ${element?.className ?? ""}`.toLowerCase();
    if (/(^|[\s_-])(title|headline|subject|caption)([\s_-]|$)/u.test(identity)) return "title";
    return "other";
  }

  function titleLikelihoodForElement(element, text) {
    const role = textRoleForElement(element);
    if (role === "title") return 1;
    if (role === "comment") return 0.05;
    const length = [...String(text ?? "").trim()].length;
    if (element?.closest?.("a") && length > 0 && length <= 48) return 0.55;
    if (length > 0 && length <= 24) return 0.22;
    return 0;
  }

  function classificationContext(text, parentElement) {
    const inherited = nearestLanguage(parentElement);
    const siteRule = matchingSiteRule(parentElement);
    const dictionary = Core.findDictionaryMatch(text, dictionaryEntries, currentHost());
    const textRole = textRoleForElement(parentElement);
    return {
      manualLanguage: manualLanguageForElement(parentElement),
      siteRuleLanguage: siteRule?.language ?? null,
      dictionaryLanguage: dictionary?.language ?? null,
      dictionaryEvidence: dictionary,
      inheritedLanguage: inherited?.language ?? null,
      inheritedDistance: inherited?.distance ?? Number.POSITIVE_INFINITY,
      locationLanguage: languageFromLocation(),
      siteDefaultLanguage: siteConfig.defaultLanguage,
      ambiguousHan: settings.ambiguousHan,
      browserLanguage: browserLanguageFallback(),
      acgTitleHeuristics: settings.acgTitleHeuristics,
      recognitionMode: settings.recognitionMode,
      textRole,
      titleLikelihood: titleLikelihoodForElement(parentElement, text),
      minimumTextLength: settings.minimumTextLength,
      maximumTextLength: settings.maximumTextLength
    };
  }

  const textEngine = TextEngine.create({
    Core,
    getContext: classificationContext,
    getRevision: () => classificationRevision,
    segmentationEnabled: () => settings.segmentMixedText,
    diagnostics,
    maxCacheEntries: 2048,
    maxCacheTextLength: 640
  });

  function classifyText(text, parentElement) {
    return textEngine.classifyText(text, parentElement);
  }

  function segmentText(text, parentElement) {
    return textEngine.segmentText(text, parentElement);
  }

  function isSerif(element) {
    const cached = serifCache.get(element);
    if (cached !== undefined) return cached;

    const family = getComputedStyle(element).fontFamily.toLowerCase();
    let result = false;
    if (
      !family.includes("sans-serif") &&
      !/(gothic|hei|yahei|jhenghei|meiryo|malgun|黑体|雅黑|ゴシック)/i.test(family)
    ) {
      result = /(serif|mincho|ming|song|simsun|pmingliu|宋体|明朝|명조|바탕)/i.test(family);
    }
    serifCache.set(element, result);
    return result;
  }

  function isProtectedMutationArea(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;
    if (!element) return false;

    return Boolean(element.closest(
      'ruby,rt,rp,[data-kt-generated="true"],[data-cjkcf-wrapper="1"],' +
      '[data-cjkcf-generated="1"],[data-cjkcf-ignore="true"]'
    ));
  }

  function shouldSkip(parent) {
    if (!parent || SKIP_TAGS.has(parent.tagName)) return true;
    if (isProtectedMutationArea(parent)) return true;
    if (parent.closest('[data-cjkcf-wrapper="1"]')) return false;
    if (parent.closest("[hidden],[aria-hidden='true']")) return true;

    try {
      if (settings.ignoreSelectors && parent.closest(settings.ignoreSelectors)) return true;
    } catch (error) {
      console.warn("[CJK Context Font] 无效的忽略选择器：", error);
    }

    return false;
  }

  function classForLanguage(language) {
    switch (language) {
      case "ja": return "cjkcf-ja";
      case "zh-Hans": return "cjkcf-zh-hans";
      case "zh-Hant": return "cjkcf-zh-hant";
      case "ko": return "cjkcf-ko";
      default: return null;
    }
  }

  function clearAppliedElement(element, { removeManual = false } = {}) {
    for (const name of LANGUAGE_CLASSES) element.classList.remove(name);
    element.classList.remove("cjkcf-sans", "cjkcf-serif");
    delete element.dataset.cjkcfLanguage;
    delete element.dataset.cjkcfReason;
    delete element.dataset.cjkcfConfidence;
    delete element.dataset.cjkcfEvidence;

    if (element.dataset.cjkcfAddedLang === "1") {
      element.removeAttribute("lang");
      delete element.dataset.cjkcfAddedLang;
    }

    if (removeManual) delete element.dataset.cjkcfManualLanguage;
  }

  function applyClassification(element, result, serif, markApplied = true) {
    clearAppliedElement(element);
    if (!result) return;

    const languageClass = classForLanguage(result.language);
    if (!languageClass) return;

    element.classList.add(languageClass, serif ? "cjkcf-serif" : "cjkcf-sans");
    element.dataset.cjkcfLanguage = result.language;
    element.dataset.cjkcfReason = result.reason;
    element.dataset.cjkcfConfidence = Number(result.confidence ?? 0).toFixed(3);
    if (Array.isArray(result.evidence) && result.evidence.length > 0) {
      element.dataset.cjkcfEvidence = result.evidence.slice(0, 8).join(",");
    }

    if (markApplied) {
      element.dataset.cjkcfApplied = "1";
    }
    diagnostics.increment("applyOperations");

    if (settings.applyLangAttribute && !element.hasAttribute("lang")) {
      element.setAttribute("lang", result.language);
      element.dataset.cjkcfAddedLang = "1";
    }
  }

  function createRun(text, result, serif, { manual = false } = {}) {
    const span = document.createElement("span");
    span.className = "cjkcf-run";
    span.dataset.cjkcfWrapper = "1";
    span.dataset.cjkcfGenerated = "1";
    span.textContent = text;
    applyClassification(span, result, serif, true);
    if (manual && result?.language) span.dataset.cjkcfManualLanguage = result.language;
    return span;
  }

  function needsSegmentedReplacement(segments) {
    if (segments.length <= 1) return false;
    const languages = new Set(
      segments.map(segment => segment.result?.language).filter(Boolean)
    );
    return languages.size > 1;
  }

  function processTextNode(textNode) {
    diagnostics.increment("textNodesSeen");
    if (cleaning || !settings.enabled || siteConfig.enabled === false || !textNode.isConnected) {
      diagnostics.increment("textNodesInactive");
      return;
    }

    const parent = textNode.parentElement;
    if (!parent || shouldSkip(parent)) {
      diagnostics.increment("textNodesSkipped");
      return;
    }

    const text = textNode.nodeValue ?? "";
    const elementRole = SiteAdapters.roleFor(parent, adapter);
    if (elementRole !== "other") diagnostics.increment(`role:${elementRole}`);

    /*
     * 稳定模式：绝不 splitText、replaceWith 或插入 span。
     * 只有元素全部可见文本由这一个文本节点构成时，才在元素本身加字体类。
     * 这样不会与 Vue/React 虚拟 DOM、ruby 注音脚本和翻译脚本争夺文本节点。
     */
    if (settings.safeDomMode) {
      if (isProtectedMutationArea(parent)) {
        diagnostics.increment("protectedSkips");
        return;
      }

      const onlyChildIsText =
        parent.childNodes.length === 1 &&
        parent.firstChild === textNode;

      if (!onlyChildIsText) {
        diagnostics.increment("complexElementSkips");
        return;
      }

      diagnostics.increment("textNodesProcessed");
      const result = classifyText(text, parent);
      if (result) {
        applyClassification(parent, result, isSerif(parent), true);
      } else if (parent.dataset.cjkcfApplied === "1") {
        clearAppliedElement(parent);
        delete parent.dataset.cjkcfApplied;
      }
      return;
    }

    if (parent.dataset.cjkcfWrapper === "1") {
      applyClassification(parent, classifyText(text, parent), isSerif(parent), true);
      return;
    }

    const segments = segmentText(text, parent);

    if (parent.dataset.cjkcfApplied === "1") {
      if (needsSegmentedReplacement(segments)) {
        const serif = isSerif(parent);
        clearAppliedElement(parent);
        delete parent.dataset.cjkcfApplied;
        const fragment = document.createDocumentFragment();
        for (const segment of segments) {
          if (segment.result) fragment.append(createRun(segment.text, segment.result, serif));
          else fragment.append(document.createTextNode(segment.text));
        }
        textNode.replaceWith(fragment);
      } else {
        applyClassification(parent, segments[0]?.result ?? classifyText(text, parent), isSerif(parent), true);
      }
      return;
    }
    if (needsSegmentedReplacement(segments)) {
      const serif = isSerif(parent);
      const fragment = document.createDocumentFragment();
      for (const segment of segments) {
        if (segment.result) fragment.append(createRun(segment.text, segment.result, serif));
        else fragment.append(document.createTextNode(segment.text));
      }
      textNode.replaceWith(fragment);
      return;
    }

    const result = segments[0]?.result ?? classifyText(text, parent);
    if (!result) return;

    const onlyChildIsText =
      parent.childNodes.length === 1 &&
      parent.firstChild === textNode &&
      !parent.hasAttribute("data-cjkcf-applied");

    if (onlyChildIsText) {
      applyClassification(parent, result, isSerif(parent), true);
      return;
    }

    textNode.replaceWith(createRun(text, result, isSerif(parent)));
  }

  function ensureShadowStyle(shadowRoot) {
    if (!shadowRoot || shadowRoot.querySelector('style[data-cjkcf-shadow-style="1"]')) return;
    const style = document.createElement("style");
    style.dataset.cjkcfShadowStyle = "1";
    style.textContent = `
      .cjkcf-ja.cjkcf-sans{font-family:var(--cjkcf-ja-sans)!important}
      .cjkcf-ja.cjkcf-serif{font-family:var(--cjkcf-ja-serif)!important}
      .cjkcf-zh-hans.cjkcf-sans{font-family:var(--cjkcf-zh-hans-sans)!important}
      .cjkcf-zh-hans.cjkcf-serif{font-family:var(--cjkcf-zh-hans-serif)!important}
      .cjkcf-zh-hant.cjkcf-sans{font-family:var(--cjkcf-zh-hant-sans)!important}
      .cjkcf-zh-hant.cjkcf-serif{font-family:var(--cjkcf-zh-hant-serif)!important}
      .cjkcf-ko.cjkcf-sans{font-family:var(--cjkcf-ko-sans)!important}
      .cjkcf-ko.cjkcf-serif{font-family:var(--cjkcf-ko-serif)!important}
    `;
    shadowRoot.prepend(style);
  }

  function scanRoot(root) {
    const scanStarted = performance.now();
    diagnostics.increment("scanRoots");
    try {
    if (cleaning || !settings.enabled || siteConfig.enabled === false || !root) return;
    if (root.nodeType === Node.ELEMENT_NODE && !root.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE && !root.isConnected) return;
    if (root instanceof ShadowRoot && !root.host?.isConnected) return;

    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }

    if (root instanceof ShadowRoot) ensureShadowStyle(root);

    if (
      root.nodeType !== Node.ELEMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || shouldSkip(parent)) return NodeFilter.FILTER_REJECT;
          return RE.cjk.test(node.nodeValue ?? "")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) processTextNode(node);

    if (settings.processOpenShadowRoots && root.querySelectorAll) {
      let inspected = 0;
      for (const element of root.querySelectorAll("*")) {
        inspected += 1;
        if (inspected > MAX_SHADOW_SCAN_ELEMENTS) break;
        if (element.shadowRoot) {
          ensureShadowStyle(element.shadowRoot);
          enqueueScan(element.shadowRoot);
          observeRoot(element.shadowRoot);
        }
      }
    }
    } finally {
      diagnostics.noteScan(performance.now() - scanStarted);
    }
  }

  function scheduleDrain() {
    if (scanScheduled) return;
    scanScheduled = true;
    const schedule = window.requestIdleCallback
      ? callback => window.requestIdleCallback(callback, { timeout: 500 })
      : callback => window.setTimeout(() => callback({ timeRemaining: () => 8 }), 16);
    schedule(drainQueue);
  }

  function enqueueScan(root) {
    if (!root || queued.has(root)) return;
    if (root.nodeType === Node.ELEMENT_NODE && !root.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE && !root.isConnected) return;
    if (root instanceof ShadowRoot && !root.host?.isConnected) return;
    if (scanQueue.length - scanQueueHead >= MAX_SCAN_QUEUE) {
      diagnostics.increment("queueDrops");
      return;
    }
    queued.add(root);
    scanQueue.push(root);
    diagnostics.noteQueue(scanQueue.length - scanQueueHead);
    scheduleDrain();
  }

  function debounceCharacterScan(textNode) {
    if (isProtectedMutationArea(textNode)) return;
    const existing = characterTimers.get(textNode);
    if (existing !== undefined) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      characterTimers.delete(textNode);
      enqueueScan(textNode);
    }, adapter.characterDebounceMs);
    characterTimers.set(textNode, timer);
  }

  function drainQueue(deadline) {
    scanScheduled = false;
    let processed = 0;

    while (scanQueueHead < scanQueue.length) {
      const root = scanQueue[scanQueueHead];
      scanQueue[scanQueueHead] = null;
      scanQueueHead += 1;
      queued.delete(root);
      scanRoot(root);
      processed += 1;

      if (processed >= 8 || (deadline.timeRemaining && deadline.timeRemaining() < 2)) break;
    }

    if (scanQueueHead >= scanQueue.length) {
      scanQueue.length = 0;
      scanQueueHead = 0;
    } else if (scanQueueHead > 512 && scanQueueHead * 2 > scanQueue.length) {
      scanQueue.splice(0, scanQueueHead);
      scanQueueHead = 0;
    }

    if (scanQueueHead < scanQueue.length) scheduleDrain();
  }

  function queueMutationRoot(node) {
    if (!node || isProtectedMutationArea(node)) return;
    if (node.nodeType === Node.ELEMENT_NODE && !node.isConnected) return;
    if (node.nodeType === Node.TEXT_NODE && !node.isConnected) return;

    mutationRoots.add(node);
    if (mutationFlushTimer !== null) return;

    // Bilibili 等无限滚动页面一次会插入大量兄弟节点。先合并一小段时间，
    // 再只扫描最上层新增根，避免 MutationObserver 风暴。
    mutationFlushTimer = window.setTimeout(flushMutationRoots, adapter.mutationDelayMs);
  }

  function flushMutationRoots() {
    mutationFlushTimer = null;
    diagnostics.increment("mutationFlushes");
    const candidates = [...mutationRoots].filter(node => {
      if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
        return node.isConnected && !isProtectedMutationArea(node);
      }
      return false;
    });
    mutationRoots.clear();

    const candidateElements = candidates.map(node =>
      node.nodeType === Node.TEXT_NODE ? node.parentElement : node
    ).filter(Boolean);

    for (const node of candidates) {
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      if (!element) continue;

      const coveredByAncestor = candidateElements.some(other =>
        other !== element && other.contains(element)
      );
      if (!coveredByAncestor) enqueueScan(node);
    }
  }

  function observeRoot(root) {
    if (!settings.observeDynamic || observedRoots.has(root)) return;
    observedRoots.add(root);

    if (!observer) {
      observer = new MutationObserver(records => {
        if (cleaning || !settings.enabled || !settings.observeDynamic || siteConfig.enabled === false) return;
        diagnostics.increment("mutationCallbacks");
        diagnostics.increment("mutationRecords", records.length);

        for (const record of records) {
          if (record.type === "characterData") {
            diagnostics.increment("characterMutations");
            debounceCharacterScan(record.target);
            continue;
          }

          diagnostics.increment("addedNodes", record.addedNodes.length);
          for (const node of record.addedNodes) {
            if (isProtectedMutationArea(node)) {
              diagnostics.increment("protectedMutationSkips");
              continue;
            }
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              (node.dataset?.cjkcfWrapper === "1" || node.dataset?.cjkcfGenerated === "1")
            ) continue;
            queueMutationRoot(node);
          }
        }
      });
    }

    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function setCssVariables() {
    const style = document.documentElement.style;
    style.setProperty("--cjkcf-ja-sans", settings.jaSans);
    style.setProperty("--cjkcf-ja-serif", settings.jaSerif);
    style.setProperty("--cjkcf-zh-hans-sans", settings.zhHansSans);
    style.setProperty("--cjkcf-zh-hans-serif", settings.zhHansSerif);
    style.setProperty("--cjkcf-zh-hant-sans", settings.zhHantSans);
    style.setProperty("--cjkcf-zh-hant-serif", settings.zhHantSerif);
    style.setProperty("--cjkcf-ko-sans", settings.koSans);
    style.setProperty("--cjkcf-ko-serif", settings.koSerif);
  }

  function collectManagedRoots() {
    const roots = [document];
    const pending = [document];
    const seen = new Set([document]);

    while (pending.length > 0) {
      const root = pending.shift();
      if (!root?.querySelectorAll) continue;
      for (const element of root.querySelectorAll("*")) {
        const shadowRoot = element.shadowRoot;
        if (shadowRoot && !seen.has(shadowRoot)) {
          seen.add(shadowRoot);
          roots.push(shadowRoot);
          pending.push(shadowRoot);
        }
      }
    }
    return roots;
  }

  function queryManagedElements(selector) {
    const result = [];
    for (const root of collectManagedRoots()) {
      result.push(...root.querySelectorAll(selector));
    }
    return result;
  }

  function cleanup({ removeManual = false } = {}) {
    diagnostics.increment("cleanupRuns");
    cleaning = true;
    document.documentElement.dataset.cjkcfEnabled = "false";

    const applied = queryManagedElements('[data-cjkcf-applied="1"]');
    const wrappers = queryManagedElements('[data-cjkcf-wrapper="1"]');

    for (const element of applied) {
      if (!element.isConnected) continue;
      clearAppliedElement(element, { removeManual });
      delete element.dataset.cjkcfApplied;
    }

    for (const wrapper of wrappers) {
      if (!wrapper.isConnected) continue;
      if (!removeManual && wrapper.dataset.cjkcfManualLanguage) {
        clearAppliedElement(wrapper);
        continue;
      }
      wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ""));
    }

    serifCache = new WeakMap();
    cleaning = false;
  }

  function currentHost() {
    return location.hostname.toLowerCase();
  }

  async function loadSettings() {
    const saved = await chrome.storage.sync.get(DEFAULTS);
    settings = { ...DEFAULTS, ...saved };
  }

  async function loadLocalState() {
    const {
      siteRules: rawRules = [],
      siteConfigs = {},
      dictionaryEntries: rawDictionaryEntries = []
    } = await chrome.storage.local.get({
      siteRules: [],
      siteConfigs: {},
      dictionaryEntries: []
    });
    const host = currentHost();
    siteRules = Array.isArray(rawRules)
      ? rawRules.filter(rule => rule?.host === host && VALID_LANGUAGES.has(rule?.language))
      : [];
    dictionaryEntries = Array.isArray(rawDictionaryEntries)
      ? rawDictionaryEntries.filter(entry =>
        VALID_LANGUAGES.has(entry?.language) && (!entry?.host || entry.host === host)
      )
      : [];
    siteConfig = {
      enabled: true,
      defaultLanguage: "auto",
      ...(siteConfigs?.[host] ?? {})
    };
  }

  function effectiveEnabled() {
    return settings.enabled && siteConfig.enabled !== false;
  }

  async function reloadAndRescan({ removeManual = false } = {}) {
    await Promise.all([loadSettings(), loadLocalState()]);
    classificationRevision += 1;
    textEngine.clearCache();
    setCssVariables();
    cleanup({ removeManual });
    document.documentElement.dataset.cjkcfEnabled = effectiveEnabled() ? "true" : "false";
    if (effectiveEnabled()) {
      enqueueScan(document);
      observeRoot(document);
    }
    updateDeveloperOverlay();
  }

  function usefulTextLength(element) {
    return (element.textContent ?? "").trim().length;
  }

  function findContextElement(target) {
    if (!(target instanceof Element)) return null;
    const wrapper = target.closest('[data-cjkcf-wrapper="1"]');
    if (wrapper) return wrapper;

    let current = target;
    let fallback = null;
    for (let depth = 0; current && depth < 7; depth += 1) {
      if (SKIP_TAGS.has(current.tagName)) return null;
      const length = usefulTextLength(current);
      if (length > 0 && length <= 500 && RE.cjk.test(current.textContent ?? "")) {
        if (!fallback) fallback = current;
        const tag = current.tagName;
        if (/^(H1|H2|H3|H4|P|LI|A|SPAN|ARTICLE|YT-FORMATTED-STRING)$/u.test(tag)) return current;
      }
      current = current.parentElement;
    }
    return fallback ?? target;
  }

  function stableClassNames(element) {
    return [...element.classList].filter(name =>
      !name.startsWith("cjkcf-") &&
      name.length <= 48 &&
      !/\d{5,}/u.test(name) &&
      !/^[a-f0-9_-]{12,}$/iu.test(name)
    ).slice(0, 2);
  }

  function selectorPart(element) {
    let part = element.tagName.toLowerCase();
    const classes = stableClassNames(element);
    if (classes.length > 0) {
      part += classes.map(name => `.${CSS.escape(name)}`).join("");
    } else if (element.parentElement) {
      const sameTag = [...element.parentElement.children]
        .filter(child => child.tagName === element.tagName);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(element) + 1})`;
      }
    }
    return part;
  }

  function generateSelector(element) {
    if (element.getRootNode() instanceof ShadowRoot) return null;

    if (element.id) {
      const idSelector = `#${CSS.escape(element.id)}`;
      try {
        if (document.querySelectorAll(idSelector).length === 1) return idSelector;
      } catch {
        // 继续生成路径。
      }
    }

    const parts = [];
    let current = element;
    for (let depth = 0; current && current !== document.documentElement && depth < 6; depth += 1) {
      parts.unshift(selectorPart(current));
      const selector = parts.join(" > ");
      try {
        const count = document.querySelectorAll(selector).length;
        if (count > 0 && count <= 8) return selector;
      } catch {
        // 继续向上构建。
      }
      current = current.parentElement;
    }
    return parts.join(" > ") || null;
  }

  function showToast(message) {
    const old = document.getElementById("cjkcf-toast-host");
    old?.remove();

    const host = document.createElement("div");
    host.id = "cjkcf-toast-host";
    host.style.cssText = "position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translateX(-50%);pointer-events:none";
    const shadow = host.attachShadow({ mode: "open" });
    const box = document.createElement("div");
    box.textContent = message;
    box.style.cssText = "max-width:min(560px,calc(100vw - 32px));padding:10px 14px;border-radius:9px;background:rgba(20,20,20,.92);color:white;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 5px 24px rgba(0,0,0,.25)";
    shadow.append(box);
    document.documentElement.append(host);
    window.setTimeout(() => host.remove(), 2600);
  }

  function applyManualToElement(element, language) {
    applyClassification(element, { language, confidence: 1, reason: "manual" }, isSerif(element), true);
    element.dataset.cjkcfManualLanguage = language;
    enqueueScan(element);
  }

  function wrapCurrentSelection(language) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (
      !range.toString().trim() ||
      range.commonAncestorContainer.getRootNode() !== document ||
      range.startContainer !== range.endContainer ||
      range.startContainer.nodeType !== Node.TEXT_NODE
    ) return null;

    const span = createRun(
      range.toString(),
      { language, confidence: 1, reason: "manual-selection" },
      isSerif(range.commonAncestorContainer.parentElement ?? document.body),
      { manual: true }
    );

    try {
      range.deleteContents();
      range.insertNode(span);
      selection.removeAllRanges();
      return span;
    } catch {
      return null;
    }
  }

  async function applyContextLanguage(language, persist) {
    if (!VALID_LANGUAGES.has(language)) return;
    if (!effectiveEnabled()) {
      showToast("请先在扩展弹窗中启用此页面。 ");
      return;
    }
    const target = findContextElement(lastContextTarget);
    if (!target) {
      showToast("没有找到可处理的文本元素。");
      return;
    }

    if (!persist) {
      const selectionWrapper = wrapCurrentSelection(language);
      if (selectionWrapper) {
        showToast("已临时设置所选文字；刷新页面后恢复。");
        return;
      }
      applyManualToElement(target, language);
      showToast("已临时设置当前元素；刷新页面后恢复。");
      return;
    }

    const selector = generateSelector(target);
    if (!selector) {
      applyManualToElement(target, language);
      showToast("已临时生效，但 Shadow DOM 内的元素暂时无法保存为站点规则。");
      return;
    }

    applyManualToElement(target, language);
    const response = await chrome.runtime.sendMessage({
      type: "CJKCF_SAVE_SITE_RULE",
      rule: {
        host: currentHost(),
        selector,
        language,
        sample: (target.textContent ?? "").trim()
      }
    });

    showToast(response?.ok
      ? `已记住规则：${selector}`
      : `保存规则失败：${response?.error ?? "未知错误"}`);
  }


  function selectedOrContextText() {
    const selection = window.getSelection();
    const selected = selection && !selection.isCollapsed
      ? Core.normalizeDictionaryTerm(selection.toString())
      : "";
    if (selected && selected.length <= 160) return selected;

    const target = findContextElement(lastContextTarget);
    const value = Core.normalizeDictionaryTerm(target?.textContent ?? "");
    return value && value.length <= 160 ? value : "";
  }

  async function saveDictionaryAtContext(language, scope) {
    if (!VALID_LANGUAGES.has(language)) return;
    const term = selectedOrContextText();
    if (!term) {
      showToast("请选择不超过 160 个字符的文字，或在较短标题上右键。");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "CJKCF_SAVE_DICTIONARY_ENTRY",
      entry: {
        term,
        language,
        matchMode: "exact",
        host: scope === "site" ? currentHost() : ""
      }
    });
    if (response?.ok) {
      const target = findContextElement(lastContextTarget);
      if (target) enqueueScan(target);
    }
    showToast(response?.ok
      ? `已将“${term.slice(0, 42)}”加入${scope === "site" ? "本站" : "全局"}词典。`
      : `保存词典失败：${response?.error ?? "未知错误"}`);
  }

  async function removeMatchingDictionaryAtContext() {
    const term = selectedOrContextText();
    if (!term) {
      showToast("没有找到可匹配的短文本。");
      return;
    }
    const matches = dictionaryEntries.filter(entry => {
      const normalizedTerm = Core.normalizeDictionaryTerm(entry.term);
      return entry.matchMode === "contains"
        ? term.includes(normalizedTerm)
        : term === normalizedTerm;
    });
    if (matches.length === 0) {
      showToast("当前文字没有匹配的个人词典项。");
      return;
    }
    const response = await chrome.runtime.sendMessage({
      type: "CJKCF_REMOVE_DICTIONARY_ENTRIES",
      ids: matches.map(entry => entry.id)
    });
    showToast(response?.ok
      ? `已删除 ${response.removed} 条词典项。`
      : `删除失败：${response?.error ?? "未知错误"}`);
  }

  function clearManualAtContext() {
    const target = findContextElement(lastContextTarget);
    const manual = target?.closest?.("[data-cjkcf-manual-language]") ??
      (target?.dataset?.cjkcfManualLanguage ? target : null);
    if (!manual) {
      showToast("当前元素没有临时标记。");
      return;
    }

    delete manual.dataset.cjkcfManualLanguage;
    clearAppliedElement(manual);
    delete manual.dataset.cjkcfApplied;
    enqueueScan(manual);
    showToast("已清除当前临时标记。");
  }

  async function removeMatchingRulesAtContext() {
    const target = findContextElement(lastContextTarget);
    if (!target) {
      showToast("没有找到可匹配的元素。");
      return;
    }

    const matching = siteRules.filter(rule => {
      try {
        return Boolean(target.closest(rule.selector));
      } catch {
        return false;
      }
    });

    if (matching.length === 0) {
      showToast("当前元素没有匹配的站点规则。");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "CJKCF_REMOVE_SITE_RULES",
      ids: matching.map(rule => rule.id)
    });
    if (response?.ok) {
      delete target.dataset.cjkcfManualLanguage;
      enqueueScan(target);
    }
    showToast(response?.ok
      ? `已删除 ${response.removed} 条站点规则。`
      : `删除失败：${response?.error ?? "未知错误"}`);
  }

  function getDiagnosticSnapshot() {
    return diagnostics.snapshot({
      enabled: effectiveEnabled(),
      safeDomMode: settings.safeDomMode,
      observeDynamic: settings.observeDynamic,
      adapterId: adapter.id,
      queueLength: Math.max(0, scanQueue.length - scanQueueHead),
      pendingMutationRoots: mutationRoots.size,
      managedElements: document.querySelectorAll('[data-cjkcf-applied="1"]').length,
      generatedWrappers: document.querySelectorAll('[data-cjkcf-wrapper="1"]').length,
      dictionaryEntries: dictionaryEntries.length,
      classificationCache: textEngine.stats()
    });
  }

  const developerOverlay = DevOverlay.create({ getSnapshot: getDiagnosticSnapshot });

  function updateDeveloperOverlay() {
    if (settings.developerOverlay && effectiveEnabled()) developerOverlay.start();
    else developerOverlay.stop();
  }

  document.addEventListener("contextmenu", event => {
    const pathTarget = event.composedPath?.().find(node => node instanceof Element);
    lastContextTarget = pathTarget ?? (
      event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null
    );
  }, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CJKCF_CONTEXT_COMMAND") {
      Promise.resolve().then(async () => {
        if (message.action === "apply") {
          await applyContextLanguage(message.language, Boolean(message.persist));
        } else if (message.action === "clear-manual") {
          clearManualAtContext();
        } else if (message.action === "remove-matching-rules") {
          await removeMatchingRulesAtContext();
        } else if (message.action === "save-dictionary") {
          await saveDictionaryAtContext(message.language, message.scope);
        } else if (message.action === "remove-matching-dictionary") {
          await removeMatchingDictionaryAtContext();
        }
        lastContextTarget = null;
        sendResponse({ ok: true });
      }).catch(error => {
        console.error("[CJK Context Font] 右键命令失败：", error);
        sendResponse({ ok: false, error: error.message });
      });
      return true;
    }

    if (message?.type === "CJKCF_GET_SITE_INFO") {
      sendResponse({
        ok: true,
        host: currentHost(),
        globalEnabled: settings.enabled,
        siteConfig,
        ruleCount: siteRules.length,
        dictionaryCount: dictionaryEntries.length
      });
      return false;
    }

    if (message?.type === "CJKCF_GET_DIAGNOSTICS") {
      sendResponse({ ok: true, diagnostics: getDiagnosticSnapshot() });
      return false;
    }

    if (message?.type === "CJKCF_RESET_DIAGNOSTICS") {
      diagnostics.reset();
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "CJKCF_RESCAN") {
      void reloadAndRescan();
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync") {
      const detectionKeys = new Set([
        "ambiguousHan", "minimumTextLength", "maximumTextLength", "ignoreSelectors",
        "processOpenShadowRoots", "safeDomMode", "segmentMixedText", "acgTitleHeuristics", "applyLangAttribute"
      ]);
      const needsRescan = Object.keys(changes).some(key => detectionKeys.has(key) || key === "enabled");
      if (needsRescan) void reloadAndRescan();
      else void loadSettings().then(() => {
        setCssVariables();
        updateDeveloperOverlay();
      });
      return;
    }

    if (areaName === "local" && (changes.siteRules || changes.siteConfigs || changes.dictionaryEntries)) {
      void reloadAndRescan();
    }
  });


  async function start() {
    await Promise.all([loadSettings(), loadLocalState()]);
    setCssVariables();
    document.documentElement.dataset.cjkcfEnabled = effectiveEnabled() ? "true" : "false";

    updateDeveloperOverlay();
    if (!effectiveEnabled()) return;
    enqueueScan(document);
    observeRoot(document);
  }

  start().catch(error => {
    diagnostics.noteError(error);
    console.error("[CJK Context Font] 启动失败：", error);
  });
})();
