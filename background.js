"use strict";

const VALID_LANGUAGES = new Set(["ja", "zh-Hans", "zh-Hant", "ko"]);
const MENU_ROOT = "cjkcf-root";

const MENU_DEFINITIONS = [
  { id: MENU_ROOT, title: "CJK Context Font", contexts: ["all"] },
  { id: "cjkcf-temp", parentId: MENU_ROOT, title: "临时设置当前文本", contexts: ["all"] },
  { id: "cjkcf-temp-ja", parentId: "cjkcf-temp", title: "日文", contexts: ["all"] },
  { id: "cjkcf-temp-zh-Hans", parentId: "cjkcf-temp", title: "简体中文", contexts: ["all"] },
  { id: "cjkcf-temp-zh-Hant", parentId: "cjkcf-temp", title: "繁体中文", contexts: ["all"] },
  { id: "cjkcf-temp-ko", parentId: "cjkcf-temp", title: "韩文", contexts: ["all"] },
  { id: "cjkcf-remember", parentId: MENU_ROOT, title: "记住此类元素", contexts: ["all"] },
  { id: "cjkcf-remember-ja", parentId: "cjkcf-remember", title: "始终按日文处理", contexts: ["all"] },
  { id: "cjkcf-remember-zh-Hans", parentId: "cjkcf-remember", title: "始终按简体中文处理", contexts: ["all"] },
  { id: "cjkcf-remember-zh-Hant", parentId: "cjkcf-remember", title: "始终按繁体中文处理", contexts: ["all"] },
  { id: "cjkcf-remember-ko", parentId: "cjkcf-remember", title: "始终按韩文处理", contexts: ["all"] },
  { id: "cjkcf-dictionary-global", parentId: MENU_ROOT, title: "加入全局词典", contexts: ["all"] },
  { id: "cjkcf-dictionary-global-ja", parentId: "cjkcf-dictionary-global", title: "日文", contexts: ["all"] },
  { id: "cjkcf-dictionary-global-zh-Hans", parentId: "cjkcf-dictionary-global", title: "简体中文", contexts: ["all"] },
  { id: "cjkcf-dictionary-global-zh-Hant", parentId: "cjkcf-dictionary-global", title: "繁体中文", contexts: ["all"] },
  { id: "cjkcf-dictionary-global-ko", parentId: "cjkcf-dictionary-global", title: "韩文", contexts: ["all"] },
  { id: "cjkcf-dictionary-site", parentId: MENU_ROOT, title: "加入当前网站词典", contexts: ["all"] },
  { id: "cjkcf-dictionary-site-ja", parentId: "cjkcf-dictionary-site", title: "日文", contexts: ["all"] },
  { id: "cjkcf-dictionary-site-zh-Hans", parentId: "cjkcf-dictionary-site", title: "简体中文", contexts: ["all"] },
  { id: "cjkcf-dictionary-site-zh-Hant", parentId: "cjkcf-dictionary-site", title: "繁体中文", contexts: ["all"] },
  { id: "cjkcf-dictionary-site-ko", parentId: "cjkcf-dictionary-site", title: "韩文", contexts: ["all"] },
  { id: "cjkcf-remove-dictionary", parentId: MENU_ROOT, title: "删除匹配当前文字的词典项", contexts: ["all"] },
  { id: "cjkcf-separator-1", parentId: MENU_ROOT, type: "separator", contexts: ["all"] },
  { id: "cjkcf-clear-manual", parentId: MENU_ROOT, title: "清除当前临时标记", contexts: ["all"] },
  { id: "cjkcf-remove-rule", parentId: MENU_ROOT, title: "删除匹配当前元素的站点规则", contexts: ["all"] },
  { id: "cjkcf-separator-2", parentId: MENU_ROOT, type: "separator", contexts: ["all"] },
  { id: "cjkcf-open-options", parentId: MENU_ROOT, title: "打开设置", contexts: ["all"] }
];

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const definition of MENU_DEFINITIONS) {
      chrome.contextMenus.create(definition, () => {
        void chrome.runtime.lastError;
      });
    }
  });
}

function versionLessThan(left, right) {
  const a = String(left ?? "0").split(".").map(part => Number(part) || 0);
  const b = String(right ?? "0").split(".").map(part => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) < (b[index] ?? 0)) return true;
    if ((a[index] ?? 0) > (b[index] ?? 0)) return false;
  }
  return false;
}

chrome.runtime.onInstalled.addListener(details => {
  createMenus();

  /*
   * 0.2.2 是稳定性迁移：旧版可能保留“文本拆分”和 lang 写入设置。
   * 这些操作会与 ruby 注音脚本、翻译脚本及虚拟 DOM 页面冲突。
   * 升级时一次性切回安全默认值；用户仍可在高级设置中自行开启实验功能。
   */
  if (details?.reason === "update" && versionLessThan(details.previousVersion, "0.2.2")) {
    void chrome.storage.sync.set({
      safeDomMode: true,
      segmentMixedText: false,
      applyLangAttribute: false,
      processOpenShadowRoots: false
    });
  }
});

function languageFromMenuId(menuItemId) {
  const value = String(menuItemId);
  for (const language of VALID_LANGUAGES) {
    if (value.endsWith(`-${language}`)) return language;
  }
  return null;
}

async function sendContextCommand(tabId, frameId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, payload, { frameId: frameId ?? 0 });
  } catch (error) {
    console.debug("[CJK Context Font] 无法向当前页面发送命令：", error);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "cjkcf-open-options") {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (tab?.id == null) return;

  const menuId = String(info.menuItemId);
  const language = languageFromMenuId(menuId);

  if (menuId.startsWith("cjkcf-temp-") && language) {
    void sendContextCommand(tab.id, info.frameId, {
      type: "CJKCF_CONTEXT_COMMAND",
      action: "apply",
      language,
      persist: false
    });
    return;
  }

  if (menuId.startsWith("cjkcf-remember-") && language) {
    void sendContextCommand(tab.id, info.frameId, {
      type: "CJKCF_CONTEXT_COMMAND",
      action: "apply",
      language,
      persist: true
    });
    return;
  }

  if (menuId.startsWith("cjkcf-dictionary-global-") && language) {
    void sendContextCommand(tab.id, info.frameId, {
      type: "CJKCF_CONTEXT_COMMAND",
      action: "save-dictionary",
      scope: "global",
      language
    });
    return;
  }

  if (menuId.startsWith("cjkcf-dictionary-site-") && language) {
    void sendContextCommand(tab.id, info.frameId, {
      type: "CJKCF_CONTEXT_COMMAND",
      action: "save-dictionary",
      scope: "site",
      language
    });
    return;
  }

  if (menuId === "cjkcf-remove-dictionary") {
    void sendContextCommand(tab.id, info.frameId, {
      type: "CJKCF_CONTEXT_COMMAND",
      action: "remove-matching-dictionary"
    });
    return;
  }

  if (menuId === "cjkcf-clear-manual") {
    void sendContextCommand(tab.id, info.frameId, {
      type: "CJKCF_CONTEXT_COMMAND",
      action: "clear-manual"
    });
    return;
  }

  if (menuId === "cjkcf-remove-rule") {
    void sendContextCommand(tab.id, info.frameId, {
      type: "CJKCF_CONTEXT_COMMAND",
      action: "remove-matching-rules"
    });
  }
});

function safeHostFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function validateRule(rawRule, sender) {
  if (!rawRule || typeof rawRule !== "object") return null;
  const language = String(rawRule.language ?? "");
  const selector = String(rawRule.selector ?? "").trim();
  const host = String(rawRule.host ?? "").trim().toLowerCase();
  const senderHost = safeHostFromUrl(sender?.url ?? "");

  if (!VALID_LANGUAGES.has(language)) return null;
  if (!host || host !== senderHost) return null;
  if (!selector || selector.length > 700) return null;

  return {
    id: crypto.randomUUID(),
    host,
    selector,
    language,
    sample: String(rawRule.sample ?? "").trim().slice(0, 160),
    createdAt: Date.now()
  };
}


function normalizeDictionaryTerm(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function validateDictionaryEntry(rawEntry, sender) {
  if (!rawEntry || typeof rawEntry !== "object") return null;
  const term = normalizeDictionaryTerm(rawEntry.term);
  const language = String(rawEntry.language ?? "");
  const matchMode = rawEntry.matchMode === "contains" ? "contains" : "exact";
  const senderHost = safeHostFromUrl(sender?.url ?? "");
  const requestedHost = String(rawEntry.host ?? "").trim().toLowerCase();
  const host = requestedHost ? senderHost : "";
  if (!term || term.length > 160 || !VALID_LANGUAGES.has(language)) return null;
  if (requestedHost && requestedHost !== senderHost) return null;
  return {
    id: crypto.randomUUID(),
    term,
    language,
    matchMode,
    host,
    createdAt: Date.now()
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CJKCF_SAVE_DICTIONARY_ENTRY") {
    const entry = validateDictionaryEntry(message.entry, sender);
    if (!entry) {
      sendResponse({ ok: false, error: "词典数据无效。" });
      return false;
    }
    chrome.storage.local.get({ dictionaryEntries: [] }).then(({ dictionaryEntries }) => {
      const entries = Array.isArray(dictionaryEntries) ? dictionaryEntries : [];
      const next = entries.filter(item => !(
        item?.term === entry.term &&
        item?.host === entry.host &&
        item?.matchMode === entry.matchMode
      ));
      next.push(entry);
      return chrome.storage.local.set({ dictionaryEntries: next });
    }).then(() => sendResponse({ ok: true, entry }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CJKCF_REMOVE_DICTIONARY_ENTRIES") {
    const ids = Array.isArray(message.ids)
      ? new Set(message.ids.map(String).slice(0, 100))
      : new Set();
    chrome.storage.local.get({ dictionaryEntries: [] }).then(({ dictionaryEntries }) => {
      const entries = Array.isArray(dictionaryEntries) ? dictionaryEntries : [];
      const next = entries.filter(entry => !ids.has(String(entry?.id)));
      return chrome.storage.local.set({ dictionaryEntries: next })
        .then(() => entries.length - next.length);
    }).then(removed => sendResponse({ ok: true, removed }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CJKCF_SAVE_SITE_RULE") {
    const rule = validateRule(message.rule, sender);
    if (!rule) {
      sendResponse({ ok: false, error: "规则数据无效。" });
      return false;
    }

    chrome.storage.local.get({ siteRules: [] }).then(({ siteRules }) => {
      const rules = Array.isArray(siteRules) ? siteRules : [];
      const withoutDuplicate = rules.filter(item => !(
        item?.host === rule.host && item?.selector === rule.selector
      ));
      withoutDuplicate.push(rule);
      return chrome.storage.local.set({ siteRules: withoutDuplicate });
    }).then(() => {
      sendResponse({ ok: true, rule });
    }).catch(error => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message?.type === "CJKCF_REMOVE_SITE_RULES") {
    const senderHost = safeHostFromUrl(sender?.url ?? "");
    const ids = Array.isArray(message.ids)
      ? new Set(message.ids.map(String).slice(0, 100))
      : new Set();

    chrome.storage.local.get({ siteRules: [] }).then(({ siteRules }) => {
      const rules = Array.isArray(siteRules) ? siteRules : [];
      const next = rules.filter(rule => !(
        rule?.host === senderHost && ids.has(String(rule?.id))
      ));
      return chrome.storage.local.set({ siteRules: next }).then(() => rules.length - next.length);
    }).then(removed => {
      sendResponse({ ok: true, removed });
    }).catch(error => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  return false;
});
