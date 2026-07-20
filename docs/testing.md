# Testing

- `npm test`: pure classification, corpus, cache and adapter unit tests.
- `npm run test:e2e`: injects the built runtime into a Chromium page and stress-tests dynamic DOM behavior.
- `npm run test:extension`: loads the actual unpacked extension in a persistent Chromium profile.
- `npm run benchmark`: exercises 60,000 classifications and verifies warm-cache behavior.
- `npm run release:check`: verifies conservative defaults and ruby protection.

The CI workflow runs all tests; the full extension test uses Xvfb on Linux.
