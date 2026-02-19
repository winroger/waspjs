# Demo React Migration Backlog

## Scope baseline (current app)
- Entry + static shell: `apps/demo/index.html`
- Active runtime module: `apps/demo/src/lib/demoRuntime.ts` (+ `src/lib/aggregationService.ts`)
- Legacy static runtime removed from repository (`apps/demo/static/js/**` deleted)
- Styling: `apps/demo/src/styles/index.css` (modularized into `tokens.css`, `base.css`, `layout.css`, `components.css`, `responsive.css`)
- Build/runtime: `apps/demo/vite.config.js`, `apps/demo/package.json`

---

## Epic 0 — Bootstrap React app inside existing demo
- [x] Add dependencies: `react`, `react-dom`
- [x] Add new entrypoint `apps/demo/src/main.tsx`
- [x] Add app root component `apps/demo/src/App.tsx`
- [x] Keep existing Vite config behavior (`publicDir`, `base`, alias)
- [x] Render React app into a single root node while preserving current page layout

**Acceptance**
- `npm run dev` and `npm run build` work without behavior regressions.

---

## Epic 1 — Move static HTML shell to React component tree
- [x] Convert top-level layout from `index.html` into React components:
  - `Navbar`
  - `Sidebar`
  - `ViewerArea`
  - `Controls`
  - `InfoModal`
- [x] Keep IDs/classes required by current CSS as transition bridge
- [x] Reduce `index.html` to minimal `#root` shell

**Acceptance**
- DOM structure and visual layout match current app.

---

## Epic 2 — State architecture migration
- [x] Replace module-level mutable runtime singleton with reducer-driven state + hook-owned refs
- [x] Create app-level state model:
  - `currentSet`, `currentMode`, `partIndex`, `partsList`, `currentColors`
  - loading + modal state
  - preview cache state
- [x] Introduce reducer (`useReducer`) for deterministic transitions
- [x] Keep side effects isolated in hooks

**Acceptance**
- UI state is reducer-driven, and integration runtime mutability is constrained to a thin adapter.

---

## Epic 3 — Extract integration layer for webwaspjs/Three
- [x] Create `src/lib/aggregationService.ts` wrapping public library API calls:
  - `createAggregationFromData`
  - `getAggregationCatalogParts`
  - `applyAggregationColors`
  - `setAggregationPartCount`
  - `frameVisualizerToScene`
- [x] Centralize visualizer lifecycle (`mount`, `dispose`, resize) in runtime service
- [x] Move camera helper logic (`centerCameraOnMesh`) into shared service/hook
- [x] Add explicit cleanup for per-set preview visualizers

**Acceptance**
- Visualizer instances are created/disposed in React lifecycle only.

---

## Epic 4 — Convert imperative flows to React hooks
- [x] Replace `bootApp()` + event wiring with component handlers
- [x] Convert `loadSet()` to async action hook
- [x] Convert warm preview pipeline to controlled effect with cancellation guards
- [x] Convert modal open/close and ESC behavior to hook-based logic
- [x] Convert slider + color picker logic to controlled inputs

**Acceptance**
- No direct `document.addEventListener` in app feature modules (except isolated utility hooks).

---

## Epic 5 — Componentization and boundaries
- [x] `components/SetList.tsx`
- [x] `components/SetCard.tsx`
- [x] `components/ModeToggle.tsx`
- [x] `components/ViewerCanvas.tsx`
- [x] `components/PartOverlay.tsx`
- [x] `components/PartCaption.tsx`
- [x] `components/ControlsPanel.tsx`
- [x] `components/InfoModal.tsx`

**Acceptance**
- Each component has typed props and no hidden global dependencies.

---

## Epic 6 — Styles and assets strategy
- [x] Keep existing CSS first (low-risk migration)
- [x] Introduce scoped structure (`src/styles/` with imports in `main.tsx`)
- [x] Remove Bulma dependency if unused after migration
- [x] Validate icon/image/static paths under Vite base path logic

**Acceptance**
- Styling is stable in dev and production base paths.

---

## Epic 7 — Testing and regression safety
- [x] Add unit tests for demo reducer/config/runtime helpers
- [x] Add smoke test for app mount and key controls
- [x] Add integration tests for:
  - [x] set switching
  - [x] aggregation/parts mode toggle
  - [x] slider changes
  - [x] part color updates
- [x] Add visualizer lifecycle test coverage (no leaked instances)

**Acceptance**
- Core flows are covered and pass in CI.

---

## Epic 8 — Cleanup and deprecation removal
- [x] Remove legacy modules from repository once React path is complete:
  - `events.ts`, `actions.ts`, `store.ts`, `viewport.ts`, `io.ts`
- [x] Remove unused migration bridge hooks (`useDemoStateBridge`, `useVisualizer`)
- [x] Remove legacy runtime imports from `src/**` (runtime now sourced from `src/lib/demoRuntime.ts` + `src/config/availableSets.ts`)
- [x] Remove unused IDs/classes kept only for transition
- [x] Update docs (`README`) with React demo architecture

**Acceptance**
- Single React codepath remains; no dead legacy bootstrap.

---

## Suggested execution order (sprints)
1. **Sprint A (safe bootstrap):** Epic 0 + Epic 1
2. **Sprint B (state + services):** Epic 2 + Epic 3
3. **Sprint C (feature parity):** Epic 4 + Epic 5
4. **Sprint D (hardening):** Epic 6 + Epic 7 + Epic 8

---

## Progress log
- [x] 2026-02-19 — Started Sprint A: React bootstrap created (`src/main.tsx`, `src/App.tsx`) and React deps added in [apps/demo/package.json](../apps/demo/package.json).
- [x] 2026-02-19 — Moved static shell to React components (`Navbar`, `Sidebar`, `ViewerArea`, `Controls`, `InfoModal`) under [apps/demo/src/components](../apps/demo/src/components).
- [x] 2026-02-19 — Reduced [apps/demo/index.html](../apps/demo/index.html) to `#root` host + React entry.
- [x] 2026-02-19 — Updated legacy bootstrap in [apps/demo/static/js/events.ts](../apps/demo/static/js/events.ts) to be idempotent and React-compatible (works even after `DOMContentLoaded`).
- [x] 2026-02-19 — Installed React runtime + type packages and validated build (`npm run build` passes).
- [x] 2026-02-19 — Added React app reducer + state bridge hook ([apps/demo/src/state/appState.ts](../apps/demo/src/state/appState.ts), [apps/demo/src/hooks/useDemoStateBridge.ts](../apps/demo/src/hooks/useDemoStateBridge.ts)) and connected mode/modal UI through React state in [apps/demo/src/App.tsx](../apps/demo/src/App.tsx).
- [x] 2026-02-19 — Added legacy-to-React bridge events via [apps/demo/static/js/eventsBus.ts](../apps/demo/static/js/eventsBus.ts) and emitters in `actions.ts` / `io.ts` / `viewport.ts`.
- [x] 2026-02-19 — Added shared integration layer [apps/demo/src/lib/aggregationService.ts](../apps/demo/src/lib/aggregationService.ts) and routed runtime aggregation calls through it from legacy modules.
- [x] 2026-02-19 — Added visualizer lifecycle hook [apps/demo/src/hooks/useVisualizer.ts](../apps/demo/src/hooks/useVisualizer.ts) and moved `centerCameraOnMesh` into shared service.
- [x] 2026-02-19 — Added explicit preview visualizer disposal via [apps/demo/static/js/store.ts](../apps/demo/static/js/store.ts#L16) and unload cleanup registration in [apps/demo/static/js/events.ts](../apps/demo/static/js/events.ts).
- [x] 2026-02-19 — Converted legacy DOM refs in [apps/demo/static/js/store.ts](../apps/demo/static/js/store.ts) from static captured nodes to live getters (stabilizes React mount timing).
- [x] 2026-02-19 — Migrated slider/color and part navigation handlers to React component props in [apps/demo/src/App.tsx](../apps/demo/src/App.tsx), [apps/demo/src/components/Controls.tsx](../apps/demo/src/components/Controls.tsx), and [apps/demo/src/components/ViewerArea.tsx](../apps/demo/src/components/ViewerArea.tsx).
- [x] 2026-02-19 — Removed duplicated legacy listeners from [apps/demo/static/js/events.ts](../apps/demo/static/js/events.ts) for slider/color/part buttons; handlers now live in React.
- [x] 2026-02-19 — Added React bootstrap hook [apps/demo/src/hooks/useDemoBootstrap.ts](../apps/demo/src/hooks/useDemoBootstrap.ts) to run initial async `loadSet()` and controlled preview warmup with cancellation guards.
- [x] 2026-02-19 — Switched [apps/demo/src/App.tsx](../apps/demo/src/App.tsx) from legacy `bootApp()` to React-driven bootstrap hook lifecycle.
- [x] 2026-02-19 — Cleaned deprecated bootstrap path: [apps/demo/static/js/main.js](../apps/demo/static/js/main.js) now marked legacy-only and [apps/demo/static/js/events.ts](../apps/demo/static/js/events.ts) reduced to compatibility no-op.
- [x] 2026-02-19 — Removed unused legacy action exports (`warmAllPreviews`, `openInfoModal`, `closeInfoModal`) from [apps/demo/static/js/actions.ts](../apps/demo/static/js/actions.ts).
- [x] 2026-02-19 — Added React dataset components [apps/demo/src/components/SetList.tsx](../apps/demo/src/components/SetList.tsx) and [apps/demo/src/components/SetCard.tsx](../apps/demo/src/components/SetCard.tsx), replacing imperative sidebar rendering.
- [x] 2026-02-19 — Removed deprecated imperative set rendering/highlighting functions from [apps/demo/static/js/actions.ts](../apps/demo/static/js/actions.ts) and updated bootstrap hook accordingly.
- [x] 2026-02-19 — Split [apps/demo/src/components/ViewerArea.tsx](../apps/demo/src/components/ViewerArea.tsx) into dedicated subcomponents: [ModeToggle](../apps/demo/src/components/ModeToggle.tsx), [ViewerCanvas](../apps/demo/src/components/ViewerCanvas.tsx), [PartOverlay](../apps/demo/src/components/PartOverlay.tsx), [PartCaption](../apps/demo/src/components/PartCaption.tsx).
- [x] 2026-02-19 — Added [apps/demo/src/components/ControlsPanel.tsx](../apps/demo/src/components/ControlsPanel.tsx) and switched [apps/demo/src/App.tsx](../apps/demo/src/App.tsx) to panel-level controls composition.
- [x] 2026-02-19 — Removed extra legacy DOM writes for set name and mode-button active toggling from [apps/demo/static/js/actions.ts](../apps/demo/static/js/actions.ts); React now owns these visuals.
- [x] 2026-02-19 — Consolidated app behavior behind [apps/demo/src/lib/demoRuntime.ts](../apps/demo/src/lib/demoRuntime.ts) and updated [apps/demo/src/App.tsx](../apps/demo/src/App.tsx) + [apps/demo/src/hooks/useDemoBootstrap.ts](../apps/demo/src/hooks/useDemoBootstrap.ts) to call runtime APIs directly.
- [x] 2026-02-19 — Migrated dataset discovery into [apps/demo/src/config/availableSets.ts](../apps/demo/src/config/availableSets.ts), removing all imports from `apps/demo/static/js` inside `src/**`.
- [x] 2026-02-19 — Validated full monorepo build after runtime consolidation (`npm run build` passes).
- [x] 2026-02-19 — Deleted deprecated legacy runtime files under `apps/demo/static/js/**` and removed unused migration hooks (`useDemoStateBridge`, `useVisualizer`).
- [x] 2026-02-19 — Added Vitest unit coverage for demo state/config/runtime helpers in [apps/demo/src/state/appState.test.ts](../apps/demo/src/state/appState.test.ts), [apps/demo/src/config/availableSets.test.ts](../apps/demo/src/config/availableSets.test.ts), and [apps/demo/src/lib/demoRuntime.test.ts](../apps/demo/src/lib/demoRuntime.test.ts).
- [x] 2026-02-19 — Hardened external consumption and base-path behavior in [apps/demo/vite.config.js](../apps/demo/vite.config.js), [apps/demo/src/components/Navbar.tsx](../apps/demo/src/components/Navbar.tsx), and [apps/demo/index.html](../apps/demo/index.html).
- [x] 2026-02-19 — Added demo smoke/integration tests in [apps/demo/src/App.test.tsx](../apps/demo/src/App.test.tsx) and bootstrap lifecycle test in [apps/demo/src/hooks/useDemoBootstrap.test.tsx](../apps/demo/src/hooks/useDemoBootstrap.test.tsx), with jsdom setup in [apps/demo/vitest.config.ts](../apps/demo/vitest.config.ts).
- [x] 2026-02-19 — Added visualizer lifecycle disposal test in [apps/demo/src/lib/demoRuntime.lifecycle.test.ts](../apps/demo/src/lib/demoRuntime.lifecycle.test.ts).
- [x] 2026-02-19 — Introduced style entrypoint [apps/demo/src/styles/index.css](../apps/demo/src/styles/index.css), removed Bulma CDN from [apps/demo/index.html](../apps/demo/index.html), and cleaned transition-only IDs/attrs in React components.
- [x] 2026-02-19 — Updated demo architecture documentation in [README.md](../README.md).
- [x] 2026-02-19 — Replaced global runtime singleton with per-app runtime instances via [apps/demo/src/lib/demoRuntime.ts](../apps/demo/src/lib/demoRuntime.ts), [apps/demo/src/App.tsx](../apps/demo/src/App.tsx), and [apps/demo/src/hooks/useDemoBootstrap.ts](../apps/demo/src/hooks/useDemoBootstrap.ts).
- [x] 2026-02-19 — Refactored demo UX for mobile/responsive usage: modular CSS architecture, mobile dataset overlay, navbar dataset trigger, and moved demo brand/favicon assets to [apps/demo/src/assets](../apps/demo/src/assets) and [public/assets](../public/assets).

---

## Key risks / mitigation
- **Three.js lifecycle leaks** → centralize create/dispose in hooks.
- **Behavior drift while replacing globals** → reducer + integration tests early.
- **Asset/base-path regressions** → test with `VITE_BASE_PATH` in CI.
- **Performance with preview warmups** → add batching / idle scheduling if needed.
