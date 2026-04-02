# AI Action Plan: WaspJS Refactoring Tasks

This document contains step-by-step instructions for an AI service to execute the recommended improvements to the `waspjs-monorepo` codebase.

## Task 1: Migrate `webwaspjs` Core to TypeScript

**Goal**: Convert all native JavaScript logic in `packages/waspjs/src/core/` to TypeScript (`.ts`) to improve reliability and provide rich type definitions.

### Implementation Steps:
1. **Rename Core Files:** 
   Rename all `.js` files within `packages/waspjs/src/core/` and `packages/waspjs/src/importers/` to `.ts`. Specifically:
   - `aggregation.js` -> `aggregation.ts`
   - `collider.js` -> `collider.ts`
   - `connection.js` -> `connection.ts`
   - `part.js` -> `part.ts`
   - `plane.js` -> `plane.ts`
   - `publicApi.js` -> `publicApi.ts`
   - `rule.js` -> `rule.ts`
   - `utilities.js` -> `utilities.ts`
   - `visualizer.js` -> `visualizer.ts`

2. **Update Type Definitions:**
   The classes currently use JSDoc types. You must convert these JSDoc annotations into explicit TypeScript types. 
   - Define interfaces for configurations where applicable (e.g., `Rule`, `Part`, and `Connection`).
   - Import `Matrix4`, `Mesh`, `BufferGeometry`, `Object3D` types from `three` directly for typed geometry math.
   - For `utilities.ts`, clearly type `checkMeshesIntersection(meshA: Mesh, meshB: Mesh): boolean`.

3. **Update Index Exports:**
   Update `packages/waspjs/src/index.js` to `index.ts` and verify all internal import/export paths no longer contain explicit `.js` extensions (or fix them to match TypeScript module resolution strategies if needed).

4. **Update Build Configuration (`tsup.config.js`):**
   - Change `entry: ['src/index.js']` to `entry: ['src/index.ts']`.
   - Set `dts: true` (instead of `false`) to ensure type declaration files are emitted into `/dist` on build.

5. **Verify Types:**
   Run `npm run build:lib` to ensure `tsup` successfully transpiles and generates `.d.ts` declaration files. Check that the tests pass with `npm run test:lib`.

---

## Task 2: Replace React `useReducer` with Zustand in `apps/demo`

**Goal**: Replace the local `useReducer` pattern in `apps/demo/src/pages/BuildScreen.tsx` with a global Zustand store for better scalability and developer ergonomics.

### Implementation Steps:

1. **Install Zustand:**
   Navigate to the frontend package and install the dependency:
   ```bash
   cd apps/demo
   npm install zustand
   ```

2. **Create Global Zustand Store:**
   - In `apps/demo/src/state/buildState.ts`, remove the `useReducer` action implementations.
   - Re-implement it as a Zustand store: `export const useBuildStore = create<BuildState & BuildActions>((set, get) => ({ ...initialState, actions ... }))`.
   - Move the reducer switch/case logic into explicit mutation functions (e.g., `setLoaded`, `setBuildMode`, `handleToggleActive`).

3. **Refactor `BuildScreen.tsx`:**
   - Remove `const [state, dispatch] = useReducer(buildReducer, initialBuildState);`.
   - Access the state via the new Zustand hooks: `const state = useBuildStore();`.
   - Update all `dispatch({ type: 'x', payload: y })` invocations to call the corresponding specific store functions directly (e.g., `state.setInfoOpen(true)`).
   - Ensure the `useEffect` implementations that depended on dispatch calls still correctly hook into the standard React reactivity primitives using the Zustand actions.

4. **Verify Application:**
   Run the demo with `npm run dev` and ensure:
   - Random mode sliders still function correctly.
   - Material/color updates successfully trigger Wasp engine re-renders.
   - Hover ghosts interact correctly with the canvas pointer contexts. 
   - Ensure no regressions occur in the browser console.
