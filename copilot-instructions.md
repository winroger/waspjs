# Copilot Instructions (Agent Plan)

Purpose: guide automated changes toward a clean library/demo split, reliable pipeline, and WASP parity.

## Structure Goals
- Split into workspaces: `packages/waspjs` (library), `apps/demo` (Vite example), shared `public/examples` fixtures; keep `ext_Wasp-master` under `fixtures/` reference-only.
- Library: ESM-first with CJS build output, `exports` map, types (TypeScript or `d.ts`), no self-dependency on published name.
- Demo: consumes local package, provides example selector, seed/reset controls, error surfacing; no build artifacts in git.

## Build & Tooling
- Use tsup/esbuild/rollup for library builds to `dist/` (esm + cjs + types). Mark sideEffects appropriately.
- Scripts: `lint`, `format`, `typecheck`, `test`, `test:watch`, `build`, `dev`, `e2e` (demo Playwright).
- ESLint + Prettier + TypeScript (or checkJs) across packages; Vitest for unit/integration; Playwright for demo smoke.
- GitHub Actions: lint + test + typecheck + build on PR/push; deploy demo to Pages on main; optional npm publish on tags.

## Data/Logic Priorities
- Fix serialization: BufferGeometry-safe mesh (de)serializers; `Rule`/`Part` fromData return instances; transform helpers consistent.
- Deterministic aggregation: seedable RNG, attempt limits, parent/child bookkeeping, connection state integrity.
- Collision pipeline: prefer colliders with BVH, configurable clearance, per-connection collider selection; documented coordinate system (Z-up mapping).
- Rules/grammar: type-aware generation, self-connection flags, validation of orphan/missing parts.

## Testing Expectations
- Unit: helpers, rule generation, plane transforms, part copy/transform, seeded aggregation, collision checks.
- Integration: load example JSONs and attempt N placements without unhandled errors; CLI-level check.
- E2E: Playwright on demo (load page, select examples, adjust slider, no console errors, parts rendered).
- Keep fixtures small and deterministic; reuse `public/examples` when possible.

## Workflow Notes
- Keep ASCII unless file already uses Unicode; avoid reverting user edits; scoped, additive changes only.
- Update docs when behavior changes; include brief rationale in summaries. Reference [.github/copilot.md](.github/copilot.md) and docs/agent-plan.md for context.

## Current Internal TODO (tracking)
- [ ] Harden serialization round-trip tests (add tests for Part/Rule/Aggregation data with BufferGeometry).
- [x] Introduce workspace move prep: scaffold `packages/waspjs` and `apps/demo` move plan and mapping.
