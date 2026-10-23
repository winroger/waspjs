# Developing WaspJS

This repository builds the `webwaspjs` package. A standalone clone is sufficient.
See [README](README.md) for usage, [REFERENCE](REFERENCE.md) for current contracts,
and [RELEASE_NOTES](RELEASE_NOTES.md) for version changes and migrations.

## Setup and checks

Node.js 18+ is required. CI runs Node 18, 20, 22 and 24; publication uses Node 24.
Install the locked development dependencies:

```sh
npm ci
npm run lint
npm test
npm run build
```

Tests use Vitest and checked-in reference fixtures. Builds produce ESM/CommonJS
bundles and source maps in ignored `dist/`. TypeScript declarations are not generated.
Changes to browser rendering require browser checks in addition to core tests.

## Source layout

- `src/core/`: model classes, technical utilities, host adapters and viewer.
- `src/operations/`: host-independent domain workflows using core behavior.
- `src/index.js`: public exports; internal adapters stay private.
- `src/types/index.js`: JSDoc shapes, not runtime validation or declaration files.
- `src/tests/`: behavior regressions and reference fixtures.

Aggregation is used through its constructor, static loader and instance methods.
Operations contribute domain workflows rather than mirroring class methods.
Preserve provenance/license notices. Use English source comments and concise JSDoc
for purpose, inputs, defaults, results and limitations. Align core class structure
with the corresponding GH Wasp module where practical. Distinguish JavaScript
tests from native Rhino/Grasshopper measurements.

## Documentation

README, REFERENCE and this contributor guide describe current behavior.
Keep previous-version comparisons, removed interfaces and migration instructions
in RELEASE_NOTES.md. Use public links and repository-local paths only. Public
usage instructions must work without neighboring repositories or private tooling.

## Release verification

The npm package contains `dist`, REFERENCE.md, RELEASE_NOTES.md, README, LICENSE.txt
and package.json. The `prepack` hook builds fresh bundles:

```sh
npm pack --dry-run
npm pack
```

Install the archive in an isolated consumer with `three@0.169.0`. Check ESM/CommonJS
exports, the README assembly example, Full/Light roundtrips and representative data.
Check bundling retains the documented import side effect. Run the supported Node
matrix and inspect archive content, source maps and dependency resolution.

Before publication:

1. Confirm package.json and lockfile root versions agree and the version is unused
   on npm. Complete review, tests and release notes.
2. Integrate the reviewed release-preparation branch into main.
3. When publication is explicitly authorized, create and push the matching stable
   tag, such as `v0.3.9`, after the source commit is on the remote.
4. Confirm the release workflow and npm package artifact complete successfully.

The [release workflow](.github/workflows/release.yml) checks that the pushed tag
matches the stable package version, then runs checks and publishes using npm
Trusted Publishing. The npm publisher must identify this repository and workflow;
GitHub needs the workflow's OIDC permission. Package publication and app upgrades
are separate actions. Local packing does not publish.
