# Demo Split & Deployment Plan

## Library (this repo)
- Release trigger: git tag `v*`.
- Workflow: `.github/workflows/release.yml` builds/tests/publishes `webwaspjs` (requires `NPM_TOKEN`).
- Versioning: tag and push; consider Changesets/semantic-release later.

## Demo (future separate repo `waspjs-demo`)
- Consume `webwaspjs` from npm (remove local alias in `vite.config.js`).
- Vite base path via env `VITE_BASE_PATH` for Pages/custom hosts.
- Workflow outline:
  - `workflow_dispatch` or `repository_dispatch` (from library release) with payload `{ version: "x.y.z" }`.
  - Steps: checkout; setup-node@v4 (node 20); `npm ci`; `npm pkg set dependencies.webwaspjs="^$VERSION"`; `npm run build`; deploy `dist/` to GitHub Pages (peaceiris/actions-gh-pages or official Pages actions).
- Assets: copy `public/examples` into demo repo or publish separately and fetch at runtime.

## Cleanup after split
- Remove `apps/demo` from workspaces and scripts in root package.json.
- Delete obsolete demo deploy workflows in this repo.
- Update README to point to the demo repo/hosted site.
