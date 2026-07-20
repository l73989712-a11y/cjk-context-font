(function (root, factory) {
  "use strict";
  root.CJKCFDevOverlay = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ getSnapshot, intervalMs = 1600 } = {}) {
    let host = null;
    let value = null;
    let timer = null;

    function ensure() {
      if (host?.isConnected) return;
      host = document.createElement("div");
      host.id = "cjkcf-dev-overlay-host";
      host.dataset.cjkcfGenerated = "1";
      host.dataset.cjkcfIgnore = "true";
      host.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:2147483647;pointer-events:none";
      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        :host{all:initial}
        pre{margin:0;padding:8px 10px;border-radius:8px;background:rgba(20,20,24,.88);color:#f5f5f5;
          box-shadow:0 4px 18px rgba(0,0,0,.24);font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;
          white-space:pre;max-width:340px}
      `;
      value = document.createElement("pre");
      value.textContent = "CJKCF diagnostics…";
      shadow.append(style, value);
      document.documentElement.append(host);
    }

    function render() {
      try {
        const snapshot = getSnapshot?.();
        if (!snapshot || !value) return;
        const counters = snapshot.counters ?? {};
        const cache = snapshot.classificationCache ?? {};
        value.textContent = [
          `CJKCF ${snapshot.version} · ${snapshot.adapterId ?? "generic"}`,
          `processed ${counters.textNodesProcessed ?? 0} · applied ${counters.applyOperations ?? 0}`,
          `mutation ${snapshot.mutationRatePerSecond ?? 0}/s · scan ${snapshot.scansPerSecond ?? 0}/s`,
          `queue ${snapshot.queueLength ?? 0}/${snapshot.queuePeak ?? 0} · max ${snapshot.longestScanMs ?? 0}ms`,
          `cache ${(100 * (cache.hitRate ?? snapshot.classificationCacheHitRate ?? 0)).toFixed(1)}% · ${cache.size ?? 0}/${cache.maxSize ?? 0}`
        ].join("\n");
      } catch {
        // 诊断 UI 绝不能影响网页功能。
      }
    }

    function start() {
      ensure();
      render();
      if (timer === null) timer = window.setInterval(render, intervalMs);
    }

    function stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      host?.remove();
      host = null;
      value = null;
    }

    return Object.freeze({ start, stop, render });
  }

  return Object.freeze({ create });
});
