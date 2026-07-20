"use strict";

const enabled = document.getElementById("enabled");
const siteEnabled = document.getElementById("siteEnabled");
const siteLanguage = document.getElementById("siteLanguage");
let activeTabId = null;
let currentHost = "";
let siteConfigs = {};
let diagnosticSnapshot = null;

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function sendToPage(message) {
  if (activeTabId == null) return null;
  try {
    return await chrome.tabs.sendMessage(activeTabId, message);
  } catch {
    return null;
  }
}


function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function renderDiagnostics(snapshot) {
  if (!snapshot) return;
  diagnosticSnapshot = snapshot;
  const counters = snapshot.counters ?? {};
  document.getElementById("diagnosticsPanel").hidden = false;
  document.getElementById("diagProcessed").textContent = formatNumber(counters.textNodesProcessed);
  document.getElementById("diagApplied").textContent = formatNumber(counters.applyOperations);
  document.getElementById("diagMutations").textContent = formatNumber(counters.mutationRecords);
  document.getElementById("diagRate").textContent = `${formatNumber(snapshot.mutationRatePerSecond)} 次/秒`;
  document.getElementById("diagQueue").textContent = formatNumber(snapshot.queuePeak);
  document.getElementById("diagLongest").textContent = `${formatNumber(snapshot.longestScanMs)} ms`;
  document.getElementById("diagAdapter").textContent = snapshot.adapterId ?? snapshot.metadata?.adapter ?? "generic";
  document.getElementById("diagCache").textContent = `${formatNumber((snapshot.classificationCache?.hitRate ?? snapshot.classificationCacheHitRate ?? 0) * 100)}%`;
  document.getElementById("diagAverage").textContent = `${formatNumber(snapshot.averageScanMs)} ms`;
  document.getElementById("diagWrappers").textContent = formatNumber(snapshot.generatedWrappers);

  const warnings = [];
  if ((counters.queueDrops ?? 0) > 0) warnings.push(`扫描队列丢弃 ${counters.queueDrops} 次`);
  if ((snapshot.longestScanMs ?? 0) > 50) warnings.push("出现超过 50 ms 的单次扫描");
  if ((snapshot.generatedWrappers ?? 0) > 0 && snapshot.safeDomMode) warnings.push("稳定模式下发现包装节点");
  if (snapshot.lastError) warnings.push(`最近错误：${snapshot.lastError}`);
  const warning = document.getElementById("diagWarning");
  warning.hidden = warnings.length === 0;
  warning.textContent = warnings.join("；");
}

async function refreshDiagnostics() {
  const response = await sendToPage({ type: "CJKCF_GET_DIAGNOSTICS" });
  if (response?.ok) renderDiagnostics(response.diagnostics);
}

async function saveSiteConfig() {
  if (!currentHost) return;
  siteConfigs[currentHost] = {
    enabled: siteEnabled.checked,
    defaultLanguage: siteLanguage.value
  };
  await chrome.storage.local.set({ siteConfigs });
}

async function initialize() {
  const global = await chrome.storage.sync.get({ enabled: true });
  enabled.checked = global.enabled;

  const tab = await activeTab();
  activeTabId = tab?.id ?? null;
  const response = await sendToPage({ type: "CJKCF_GET_SITE_INFO" });

  if (!response?.ok) {
    document.getElementById("unsupported").hidden = false;
    return;
  }

  currentHost = response.host;
  const local = await chrome.storage.local.get({ siteConfigs: {} });
  siteConfigs = local.siteConfigs ?? {};
  const config = siteConfigs[currentHost] ?? response.siteConfig ?? {
    enabled: true,
    defaultLanguage: "auto"
  };

  document.getElementById("sitePanel").hidden = false;
  document.getElementById("siteName").textContent = currentHost;
  document.getElementById("ruleCount").textContent = `此站有 ${response.ruleCount ?? 0} 条元素规则，${response.dictionaryCount ?? 0} 条可用词典项。`;
  siteEnabled.checked = config.enabled !== false;
  siteLanguage.value = config.defaultLanguage ?? "auto";
  await refreshDiagnostics();
}

enabled.addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: enabled.checked });
});

siteEnabled.addEventListener("change", saveSiteConfig);
siteLanguage.addEventListener("change", saveSiteConfig);

document.getElementById("rescan").addEventListener("click", async () => {
  await sendToPage({ type: "CJKCF_RESCAN" });
  window.close();
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

initialize();


document.getElementById("copyDiagnostics").addEventListener("click", async () => {
  if (!diagnosticSnapshot) await refreshDiagnostics();
  if (!diagnosticSnapshot) return;
  const report = {
    extension: "CJK Context Font",
    ...diagnosticSnapshot
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    document.getElementById("copyDiagnostics").textContent = "已复制";
  } catch {
    document.getElementById("copyDiagnostics").textContent = "复制失败";
  }
});

document.getElementById("resetDiagnostics").addEventListener("click", async () => {
  await sendToPage({ type: "CJKCF_RESET_DIAGNOSTICS" });
  await refreshDiagnostics();
});
