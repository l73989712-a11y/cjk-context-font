# Releasing

1. Update versions in `package.json` and `src/manifest.json`.
2. Update `CHANGELOG.md`.
3. Run `npm run check`, `npm test`, `npm run release:check`, and `npm run package`.
4. Commit and push.
5. Create and push a tag such as `v0.5.0`.

The `Release` workflow packages the extension and creates a GitHub Release with the Chromium and source ZIP files.

Never upload a source ZIP as the repository contents. The repository should contain the extracted source tree; ZIP files belong in Releases or CI artifacts.
