# Packages

Workspace packages live here. Currently active package:
- [waspjs](waspjs) – core library published as `webwaspjs` (ESM + CJS) built with tsup.

Root scripts that target packages:
- `npm run build:lib` – builds the library via tsup
- `npm run test` / `npm run test:watch` – vitest suite under [waspjs/tests](waspjs/tests)
- `npm run lint` – eslint over [waspjs/src](waspjs/src) and tests
