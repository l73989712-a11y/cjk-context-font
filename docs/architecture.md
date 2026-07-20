# Architecture

## Runtime modules

The unpacked Chromium build is flat because browser extension manifests are easiest to audit that way. The source repository is modular:

- `core.js`: pure CJK classification and dictionary matching.
- `text-engine.js`: mixed-text segmentation and bounded LRU classification cache.
- `site-adapters.js`: declarative per-site scheduling metadata.
- `diagnostics.js`: numeric counters, gauges, rates and error summaries.
- `dev-overlay.js`: optional numeric-only developer overlay.
- `content.js`: DOM scanning, stable application, MutationObserver and page messaging.
- `background.js`: context menus and persisted rules.

`scripts/build.py` copies source files into `dist/chromium/`; it does not download or generate remote code.

## Stability boundary

Safe DOM mode is the default. In that mode, the extension only adds classes to elements whose content is one text node. It never splits or replaces text nodes. Ruby and known generated annotation regions are always protected.

## Site adapters

Adapters only adjust scheduling and expose selector metadata in 0.5.0. They do not execute site-provided code and cannot download updates. Future site-specific behavior must remain declarative and covered by regression tests.
