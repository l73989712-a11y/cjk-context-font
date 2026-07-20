"use strict";

const DEFAULTS = {
  enabled: true,
  ambiguousHan: "inherit",
  observeDynamic: true,
  processOpenShadowRoots: false,
  safeDomMode: true,
  segmentMixedText: false,
  acgTitleHeuristics: true,
  applyLangAttribute: false,
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
};

const LANGUAGE_NAMES = {
  ja: "日文",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁体中文",
  ko: "韩文",
  auto: "自动判断"
};

const IDS = Object.keys(DEFAULTS);
let localState = { siteRules: [], siteConfigs: {}, dictionaryEntries: [] };
const Core = globalThis.CJKCFCore;

function setStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
  window.clearTimeout(setStatus.timeout);
  setStatus.timeout = window.setTimeout(() => { status.textContent = ""; }, 3500);
}

function setForm(values) {
  for (const id of IDS) {
    const element = document.getElementById(id);
    if (!element) continue;
    if (element.type === "checkbox") element.checked = Boolean(values[id]);
    else element.value = values[id];
  }
}

function readForm() {
  const values = {};
  for (const id of IDS) {
    const element = document.getElementById(id);
    if (!element) continue;
    if (element.type === "checkbox") values[id] = element.checked;
    else if (element.type === "number") values[id] = Number(element.value);
    else values[id] = element.value.trim();
  }
  return values;
}

function createEmpty(message) {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

function createDeleteButton(onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "danger small-button";
  button.textContent = "删除";
  button.addEventListener("click", onClick);
  return button;
}

function renderRules() {
  const container = document.getElementById("rulesList");
  container.replaceChildren();

  const rules = [...localState.siteRules].sort((a, b) =>
    String(a.host).localeCompare(String(b.host)) || Number(b.createdAt) - Number(a.createdAt)
  );

  if (rules.length === 0) {
    container.append(createEmpty("尚未保存站点规则。"));
    return;
  }

  for (const rule of rules) {
    const item = document.createElement("article");
    item.className = "rule-item";

    const main = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = `${rule.host} · ${LANGUAGE_NAMES[rule.language] ?? rule.language}`;
    const selector = document.createElement("code");
    selector.textContent = rule.selector;
    const sample = document.createElement("p");
    sample.className = "rule-sample";
    sample.textContent = rule.sample ? `示例：${rule.sample}` : "无文本示例";
    main.append(heading, selector, sample);

    item.append(main, createDeleteButton(async () => {
      localState.siteRules = localState.siteRules.filter(item => item.id !== rule.id);
      await chrome.storage.local.set({ siteRules: localState.siteRules });
      renderRules();
      setStatus("已删除站点规则。刷新对应网页后生效。");
    }));
    container.append(item);
  }
}


function renderDictionary() {
  const container = document.getElementById("dictionaryList");
  container.replaceChildren();
  const entries = [...localState.dictionaryEntries].sort((a, b) =>
    String(a.host ?? "").localeCompare(String(b.host ?? "")) ||
    String(a.term ?? "").localeCompare(String(b.term ?? ""))
  );
  if (entries.length === 0) {
    container.append(createEmpty("个人词典为空。可以使用上方表单或网页右键菜单添加。"));
    return;
  }
  for (const entry of entries) {
    const item = document.createElement("article");
    item.className = "rule-item";
    const main = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = `${entry.term} · ${LANGUAGE_NAMES[entry.language] ?? entry.language}`;
    const details = document.createElement("p");
    details.className = "rule-sample";
    details.textContent = `${entry.matchMode === "contains" ? "包含匹配" : "完全匹配"} · ${entry.host || "所有网站"}`;
    main.append(heading, details);
    item.append(main, createDeleteButton(async () => {
      localState.dictionaryEntries = localState.dictionaryEntries.filter(item => item.id !== entry.id);
      await chrome.storage.local.set({ dictionaryEntries: localState.dictionaryEntries });
      renderDictionary();
      setStatus("已删除词典项。已打开的页面会自动重新扫描。");
    }));
    container.append(item);
  }
}

async function addDictionaryEntry() {
  const term = Core.normalizeDictionaryTerm(document.getElementById("dictionaryTerm").value);
  const language = document.getElementById("dictionaryLanguage").value;
  const matchMode = document.getElementById("dictionaryMatchMode").value;
  const host = document.getElementById("dictionaryHost").value.trim().toLowerCase().replace(/^https?:\/\//u, "").split("/")[0];
  if (!term || term.length > 160) {
    setStatus("请输入 1–160 个字符的词语或标题。");
    return;
  }
  const entry = {
    id: crypto.randomUUID(), term, language,
    matchMode: matchMode === "contains" ? "contains" : "exact",
    host, createdAt: Date.now()
  };
  localState.dictionaryEntries = localState.dictionaryEntries.filter(item => !(
    item.term === entry.term && item.host === entry.host && item.matchMode === entry.matchMode
  ));
  localState.dictionaryEntries.push(entry);
  await chrome.storage.local.set({ dictionaryEntries: localState.dictionaryEntries });
  document.getElementById("dictionaryTerm").value = "";
  renderDictionary();
  setStatus("已添加词典项。");
}

function runPlayground() {
  const text = document.getElementById("playgroundText").value;
  const host = document.getElementById("playgroundHost").value.trim().toLowerCase();
  const fallback = document.getElementById("playgroundFallback").value;
  const dictionary = Core.findDictionaryMatch(text, localState.dictionaryEntries, host);
  const result = Core.classifyText(text, {
    minimumTextLength: 1,
    maximumTextLength: 5000,
    inheritedLanguage: null,
    inheritedDistance: Infinity,
    locationLanguage: null,
    siteDefaultLanguage: "auto",
    ambiguousHan: fallback,
    browserLanguage: fallback === "inherit" ? "zh-Hans" : null,
    acgTitleHeuristics: document.getElementById("acgTitleHeuristics").checked,
    dictionaryLanguage: dictionary?.language ?? null,
    dictionaryEvidence: dictionary
  });
  document.getElementById("playgroundResult").textContent = result
    ? JSON.stringify(result, null, 2)
    : "null（当前规则选择不处理）";
}

function renderSiteConfigs() {
  const container = document.getElementById("siteConfigsList");
  container.replaceChildren();
  const entries = Object.entries(localState.siteConfigs)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    container.append(createEmpty("尚未设置站点偏好。"));
    return;
  }

  for (const [host, config] of entries) {
    const item = document.createElement("article");
    item.className = "rule-item";
    const main = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = host;
    const details = document.createElement("p");
    details.className = "rule-sample";
    details.textContent = `${config.enabled === false ? "已停用" : "已启用"} · 纯汉字：${LANGUAGE_NAMES[config.defaultLanguage ?? "auto"] ?? "自动判断"}`;
    main.append(heading, details);

    item.append(main, createDeleteButton(async () => {
      delete localState.siteConfigs[host];
      await chrome.storage.local.set({ siteConfigs: localState.siteConfigs });
      renderSiteConfigs();
      setStatus("已删除站点偏好。刷新对应网页后生效。");
    }));
    container.append(item);
  }
}

async function restore() {
  const [values, local] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    chrome.storage.local.get({ siteRules: [], siteConfigs: {}, dictionaryEntries: [] })
  ]);
  setForm({ ...DEFAULTS, ...values });
  localState = {
    siteRules: Array.isArray(local.siteRules) ? local.siteRules : [],
    siteConfigs: local.siteConfigs && typeof local.siteConfigs === "object"
      ? local.siteConfigs
      : {},
    dictionaryEntries: Array.isArray(local.dictionaryEntries) ? local.dictionaryEntries : []
  };
  renderDictionary();
  renderRules();
  renderSiteConfigs();
}

async function save() {
  try {
    await chrome.storage.sync.set(readForm());
    setStatus("已保存；已打开的网页会自动重新扫描。");
  } catch (error) {
    setStatus(`保存失败：${error.message}`);
  }
}

async function reset() {
  await chrome.storage.sync.set(DEFAULTS);
  setForm(DEFAULTS);
  setStatus("已恢复默认识别和字体设置；站点规则未删除。");
}

async function exportRules() {
  const payload = {
    format: "cjk-context-font-rules",
    version: 2,
    exportedAt: new Date().toISOString(),
    siteRules: localState.siteRules,
    siteConfigs: localState.siteConfigs,
    dictionaryEntries: localState.dictionaryEntries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cjk-context-font-rules.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("已导出站点规则。 ");
}

async function importRules(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== "cjk-context-font-rules") throw new Error("文件格式不正确");
    const importedRules = Array.isArray(payload.siteRules) ? payload.siteRules : [];
    const importedConfigs = payload.siteConfigs && typeof payload.siteConfigs === "object"
      ? payload.siteConfigs
      : {};
    const importedDictionary = Array.isArray(payload.dictionaryEntries) ? payload.dictionaryEntries : [];

    const byKey = new Map();
    for (const rule of [...localState.siteRules, ...importedRules]) {
      if (!rule?.host || !rule?.selector || !rule?.language) continue;
      byKey.set(`${rule.host}\n${rule.selector}`, rule);
    }

    const dictionaryByKey = new Map();
    for (const entry of [...localState.dictionaryEntries, ...importedDictionary]) {
      const term = Core.normalizeDictionaryTerm(entry?.term);
      if (!term || !entry?.language) continue;
      const host = String(entry.host ?? "").toLowerCase();
      const matchMode = entry.matchMode === "contains" ? "contains" : "exact";
      dictionaryByKey.set(`${host}
${matchMode}
${term}`, {
        ...entry, id: entry.id || crypto.randomUUID(), term, host, matchMode
      });
    }
    localState.siteRules = [...byKey.values()];
    localState.siteConfigs = { ...localState.siteConfigs, ...importedConfigs };
    localState.dictionaryEntries = [...dictionaryByKey.values()];
    await chrome.storage.local.set(localState);
    renderDictionary();
    renderRules();
    renderSiteConfigs();
    setStatus("已导入并合并站点规则。 ");
  } catch (error) {
    setStatus(`导入失败：${error.message}`);
  }
}

document.getElementById("addDictionary").addEventListener("click", addDictionaryEntry);
document.getElementById("runPlayground").addEventListener("click", runPlayground);
document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", reset);
document.getElementById("exportRules").addEventListener("click", exportRules);
document.getElementById("importRules").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) void importRules(file);
  event.target.value = "";
});

restore().catch(error => setStatus(`读取设置失败：${error.message}`));
