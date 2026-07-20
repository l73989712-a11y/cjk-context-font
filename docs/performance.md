# Performance

## Classification cache

`text-engine.js` uses a 2,048-entry LRU cache. A key includes the text, classification context and a revision number. Settings, dictionaries or site rules increment the revision and clear the cache.

The cache stores no DOM nodes. Entries for text longer than 640 characters are not cached.

## Dynamic pages

Mutation records are coalesced before scanning. Each site adapter can choose conservative delay values; Bilibili and ChatGPT use longer windows than static pages. The scan queue is bounded and detached nodes are ignored.

## Diagnostics

The popup and optional overlay expose counts and timings, not webpage text. Useful values include cache hit rate, mutation rate, queue peak, average scan time and longest scan.

Run the non-gating benchmark with:

```bash
npm run benchmark
```

Benchmark timings vary by machine, so CI verifies correctness and cache behavior rather than enforcing a fragile millisecond target.
