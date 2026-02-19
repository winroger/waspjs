# Demo React Migration Backlog

## Scope baseline (current app)
- Entry + static shell: `apps/demo/index.html`
- Runtime modules: `apps/demo/static/js/main.js`, `events.ts`, `actions.ts`, `store.ts`, `viewport.ts`, `io.ts`, `config.js`
- Styling: `apps/demo/static/css/styles.css`
- Build/runtime: `apps/demo/vite.config.js`, `apps/demo/package.json`

---

## Epic 0 — Bootstrap React app inside existing demo
- [ ] Add dependencies: `react`, `react-dom`
- [ ] Add new entrypoint `apps/demo/src/main.tsx`
- [ ] Add app root component `apps/demo/src/App.tsx`
- [ ] Keep existing Vite config behavior (`publicDir`, `base`, alias)
- [ ] Render React app into a single root node while preserving current page layout

**Acceptance**
- `npm run dev` and `npm run build` work without behavior regressions.

---

## Epic 1 — Move static HTML shell to React component tree
- [ ] Convert top-level layout from `index.html` into React components:
  - `Navbar`
  - `Sidebar`
  - `ViewerArea`
  - `Controls`
  - `InfoModal`
- [ ] Keep IDs/classes required by current CSS as transition bridge
- [ ] Reduce `index.html` to minimal `#root` shell

**Acceptance**
- DOM structure and visual layout match current app.

---

## Epic 2 — State architecture migration
- [ ] Replace mutable singleton `state`/`refs` with React state + refs
- [ ] Create app-level state model:
  - `currentSet`, `currentMode`, `partIndex`, `partsList`, `currentColors`
  - loading + modal state
  - preview cache state
- [ ] Introduce reducer (`useReducer`) for deterministic transitions
- [ ] Keep side effects isolated in hooks

**Acceptance**
- No direct cross-module mutable globals remain.

---

## Epic 3 — Extract integration layer for webwaspjs/Three
- [ ] Create `src/lib/aggregationService.ts` wrapping public library API calls:
  - `createAggregationFromData`
  - `getAggregationCatalogParts`
  - `applyAggregationColors`
  - `setAggregationPartCount`
  - `frameVisualizerToScene`
- [ ] Create `useVisualizer` hook for lifecycle (`mount`, `dispose`, resize)
- [ ] Move camera helper logic (`centerCameraOnMesh`) into shared service/hook
- [ ] Add explicit cleanup for per-set preview visualizers

**Acceptance**
- Visualizer instances are created/disposed in React lifecycle only.

---

## Epic 4 — Convert imperative flows to React hooks
- [ ] Replace `bootApp()` + event wiring with component handlers
- [ ] Convert `loadSet()` to async action hook
- [ ] Convert warm preview pipeline to controlled effect with cancellation guards
- [ ] Convert modal open/close and ESC behavior to hook-based logic
- [ ] Convert slider + color picker logic to controlled inputs

**Acceptance**
- No direct `document.addEventListener` in app feature modules (except isolated utility hooks).

---

## Epic 5 — Componentization and boundaries
- [ ] `components/SetList.tsx`
- [ ] `components/SetCard.tsx`
- [ ] `components/ModeToggle.tsx`
- [ ] `components/ViewerCanvas.tsx`
- [ ] `components/PartOverlay.tsx`
- [ ] `components/PartCaption.tsx`
- [ ] `components/ControlsPanel.tsx`
- [ ] `components/InfoModal.tsx`

**Acceptance**
- Each component has typed props and no hidden global dependencies.

---

## Epic 6 — Styles and assets strategy
- [ ] Keep existing CSS first (low-risk migration)
- [ ] Introduce scoped structure (`src/styles/` with imports in `main.tsx`)
- [ ] Remove Bulma dependency if unused after migration
- [ ] Validate icon/image/static paths under Vite base path logic

**Acceptance**
- Styling is stable in dev and production base paths.

---

## Epic 7 — Testing and regression safety
- [ ] Add smoke test for app mount and key controls
- [ ] Add integration tests for:
  - set switching
  - aggregation/parts mode toggle
  - slider changes
  - part color updates
- [ ] Add visualizer lifecycle test coverage (no leaked instances)

**Acceptance**
- Core flows are covered and pass in CI.

---

## Epic 8 — Cleanup and deprecation removal
- [ ] Remove legacy modules once React path is complete:
  - `events.ts`, `actions.ts`, `store.ts`, `viewport.ts`, `io.ts`
- [ ] Remove unused IDs/classes kept only for transition
- [ ] Update docs (`README`) with React demo architecture

**Acceptance**
- Single React codepath remains; no dead legacy bootstrap.

---

## Suggested execution order (sprints)
1. **Sprint A (safe bootstrap):** Epic 0 + Epic 1
2. **Sprint B (state + services):** Epic 2 + Epic 3
3. **Sprint C (feature parity):** Epic 4 + Epic 5
4. **Sprint D (hardening):** Epic 6 + Epic 7 + Epic 8

---

## Key risks / mitigation
- **Three.js lifecycle leaks** → centralize create/dispose in hooks.
- **Behavior drift while replacing globals** → reducer + integration tests early.
- **Asset/base-path regressions** → test with `VITE_BASE_PATH` in CI.
- **Performance with preview warmups** → add batching / idle scheduling if needed.
