# Developing WaspJS

This repository builds the `webwaspjs` package. A standalone clone is sufficient;
no adjacent application, schema or documentation repository is needed.
See [README](README.md) for use and [REFERENCE.md](REFERENCE.md) for the public contracts.

## Setup and checks

The package declares Node.js 18+; CI runs Node.js 20 and the publication workflow
uses Node.js 24. Use the lockfile for reproducible development installs:

```sh
npm ci
npm run lint
npm test
npm run build
```

Tests use Vitest and checked-in reference fixtures. The build produces ESM and
CommonJS bundles plus source maps in `dist/`; TypeScript declaration generation is
disabled. `dist/` is generated and ignored by Git. Browser viewer changes also
need real DOM/WebGL checks; the core test suite does not verify viewer lifecycle.

## Source layout and documentation

- `src/core/`: model classes, technical utilities, host adapters and viewer.
- `src/operations/`: host-independent domain workflows, including GH-component
  equivalents with additional domain logic. Do not mirror class methods here.
  Aggregation queries belong to the core class; shared evaluators stay internal.
  Aggregation is exposed through its class, without standalone function aliases
  or a separate compatibility module.
- `src/index.js`: public runtime exports; internal adapters stay out of this entry.
- `src/types/index.js`: JSDoc shapes; these are neither runtime validation nor `.d.ts` output.
- `src/tests/`: regressions and measured reference fixtures, including unsupported cases.

Follow [AGENTS.md](AGENTS.md) for source structure and comment conventions.
Retain provenance/license notices. Label GH counterparts, host adapters and
JS-specific helpers accurately; a shared method name does not prove parity.
Keep public contracts in REFERENCE.md and runnable onboarding in README rather than
copying internal planning or measurement logs into consumer documentation.

Use a feature branch from local `main`. Describe observable behavior and appropriate
regressions. Report JavaScript checks separately from native GH measurements; do
not claim a new Rhino test when only replaying an existing fixture.

## Inspect a release candidate

After checks pass, pack locally and inspect the archive:

```sh
npm pack --dry-run
npm pack
```

The `prepack` hook builds fresh bundles for packing/publication. `npm pack` creates
a local archive; it does not publish. The intended package contains `dist/`,
`REFERENCE.md`, README, LICENSE.txt and package.json. Tests, agent instructions, local
notes, dependencies and build tools stay outside the archive. Source maps include
the library sources for debugging; they are intentional.

Install the resulting tarball in a temporary consumer with `three@^0.169.0`. Verify
both `import` and `require`, the README construction/Full-Light roundtrip, and a
representative real dataset. A browser/bundler smoke check is needed for viewer
changes. Review package identity and peer resolution, not only its version text.

Before a release, select the version and public release notes, run the supported
CI/release Node versions, and test downstream applications separately before they
upgrade. No application imports this sibling source tree automatically.

The existing [release workflow](.github/workflows/release.yml) publishes on pushed
`v*` tags. Do not push a trial tag: the workflow currently has no prerelease-tag
routing or tag/package-version guard. Versioning, tags, push and publication are
separate reviewed release actions; a local documentation cleanup performs none.
