# Updating the GitHub repository

## Recommended browser-only method

Because 0.5.0 moves runtime source files into `src/`, merely uploading new files would leave obsolete 0.4.0 files at the repository root.

1. Test the Chromium release ZIP locally first.
2. Extract `cjk-context-font-0.5.0-source.zip`.
3. Open the repository and press `.` to launch GitHub's browser editor (`github.dev`).
4. Delete the obsolete root runtime files:
   - `background.js`
   - `content.css`
   - `content.js`
   - `core.js`
   - `diagnostics.js`
   - `manifest.json`
   - `options.html`
   - `options.js`
   - `popup.html`
   - `popup.js`
   - `test.html`
   - `ui.css`
5. Drag the extracted 0.5.0 source contents into the Explorer panel. Keep `README.md`, `LICENSE`, docs, tests and workflows at their shown paths.
6. Review the Source Control panel and commit with a message such as `Release v0.5.0`.

Do not upload either ZIP as a normal repository file. ZIP files belong in GitHub Releases.

## Git method

```bash
git pull
# Replace the working tree with the extracted 0.5.0 source files.
git add -A
git commit -m "Release v0.5.0"
git push
```

`git add -A` is important because it records both additions and deleted obsolete root files.
