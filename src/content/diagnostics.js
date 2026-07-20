(function (root, factory) {
  "use strict";
  root.CJKCFDiagnostics = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ version = "unknown", host = "" } = {}) {
    const startedAt = Date.now();
    let resetAt = startedAt;
    const counters = Object.create(null);
    const reasons = Object.create(null);
    const gauges = Object.create(null);
    const metadata = Object.create(null);
    let queuePeak = 0;
    let longestScanMs = 0;
    let lastError = "";
    let lastErrorAt = 0;

    function increment(name, amount = 1) {
      counters[name] = (counters[name] ?? 0) + amount;
    }

    function noteReason(reason) {
      if (!reason) return;
      reasons[reason] = (reasons[reason] ?? 0) + 1;
    }

    function noteQueue(length) {
      if (Number.isFinite(length)) queuePeak = Math.max(queuePeak, length);
    }

    function noteScan(durationMs) {
      const duration = Number.isFinite(durationMs) ? durationMs : 0;
      increment("scanRuns");
      increment("scanTimeMs", duration);
      longestScanMs = Math.max(longestScanMs, duration);
    }

    function setGauge(name, value) {
      if (Number.isFinite(value)) gauges[name] = value;
      else delete gauges[name];
    }

    function setMetadata(name, value) {
      if (value === undefined || value === null || value === "") delete metadata[name];
      else metadata[name] = String(value).slice(0, 160);
    }

    function noteError(error) {
      increment("errors");
      lastError = String(error?.message ?? error ?? "unknown error").slice(0, 500);
      lastErrorAt = Date.now();
    }

    function reset() {
      for (const key of Object.keys(counters)) delete counters[key];
      for (const key of Object.keys(reasons)) delete reasons[key];
      for (const key of Object.keys(gauges)) delete gauges[key];
      queuePeak = 0;
      longestScanMs = 0;
      lastError = "";
      lastErrorAt = 0;
      resetAt = Date.now();
    }

    function snapshot(extra = {}) {
      const now = Date.now();
      const elapsedSeconds = Math.max(1, (now - resetAt) / 1000);
      const mutationRecords = counters.mutationRecords ?? 0;
      const scans = counters.scanRuns ?? 0;
      const cacheHits = counters.classificationCacheHits ?? 0;
      const cacheMisses = counters.classificationCacheMisses ?? 0;
      const cacheTotal = cacheHits + cacheMisses;
      return {
        version,
        host,
        startedAt,
        resetAt,
        elapsedMs: now - resetAt,
        counters: { ...counters },
        reasons: { ...reasons },
        gauges: { ...gauges },
        metadata: { ...metadata },
        queuePeak,
        longestScanMs: Number(longestScanMs.toFixed(2)),
        averageScanMs: Number(((counters.scanTimeMs ?? 0) / Math.max(1, scans)).toFixed(3)),
        scansPerSecond: Number((scans / elapsedSeconds).toFixed(2)),
        mutationRatePerSecond: Number((mutationRecords / elapsedSeconds).toFixed(2)),
        classificationCacheHitRate: cacheTotal
          ? Number((cacheHits / cacheTotal).toFixed(4))
          : 0,
        lastError,
        lastErrorAt,
        ...extra
      };
    }

    return Object.freeze({
      increment, noteReason, noteQueue, noteScan,
      setGauge, setMetadata, noteError, reset, snapshot
    });
  }

  return Object.freeze({ create });
});
