# webwaspjs

<p align="center">
  <a href="https://www.npmjs.com/package/webwaspjs">
    <img src="https://img.shields.io/npm/v/webwaspjs.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/webwaspjs">
    <img src="https://img.shields.io/npm/dm/webwaspjs.svg" alt="npm downloads">
  </a>
  <a href="https://github.com/winroger/waspjs/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/winroger/waspjs/ci.yml?branch=main" alt="CI status">
  </a>
  <a href="https://github.com/winroger/waspjs/blob/main/LICENSE.txt">
    <img src="https://img.shields.io/github/license/winroger/waspjs.svg" alt="license">
  </a>
</p>

`webwaspjs` is a JavaScript library for loading and growing discrete aggregation systems in the browser.

## Install

```bash
npm install webwaspjs three
```

`three` is a required peer dependency and must be installed by the consuming application.

## Quick start

```js
import { createAggregationFromData } from 'webwaspjs';

const aggregation = createAggregationFromData(aggregationData);
const roundtripExport = aggregation.toData();
const lightweightRoundtripExport = aggregation.toData(false);
const fileExport = aggregation.toFileData();

console.log(Object.keys(aggregation.parts));
console.log(aggregation.rules.length);
console.log(JSON.stringify(roundtripExport));
console.log(JSON.stringify(lightweightRoundtripExport));
console.log(JSON.stringify(fileExport));
```

Main entry points:

- `createAggregationFromData(data)` to rebuild an aggregation from serialized data
- `aggregation.toData()` to export the full roundtrip/core aggregation data
- `aggregation.toData(false)` to export roundtrip/core data without per-instance aggregated geometry or colliders
- `aggregation.toFileData()` to export the compact placed-parts file format
- `Aggregation` for direct access to the core model
- `Visualizer` for simple browser rendering

### Part attributes

`Part.attributes` is an optional array of JSON values. The array and its nested values are copied when a part is constructed, copied, transformed, serialized, or deserialized. Placed parts retain their own attributes in both full and lightweight `Aggregation.toData()` exports. Older data without an `attributes` field loads with an empty array; a lightweight placed part can inherit attributes from its base part.

The original Python [Wasp Part implementation](https://github.com/ar0551/Wasp/blob/main/src/wasp/core/parts.py) omits attributes from `to_data()` and ignores them in `from_data()`. It can read the additional field in a `webwaspjs` export, but importing and exporting through Python Wasp will discard those attributes. Python Wasp attribute objects that contain Rhino geometry are outside this JSON data format.

## Development

Requirements:

- Node.js 18+
- npm 9+

Commands:

- `npm install`
- `npm run lint`
- `npm test`
- `npm run build`

## Project layout

```text
src/                    library source
src/tests/              vitest suite
src/tests/fixtures/     JSON fixtures used by tests
dist/                   build output
```

## Related repositories

- [Wasp Atas Explorer with demo showcases](https://github.com/Wasp-Framework/Wasp-Atas-Explorer)
- [Growing Collection of Wasp Datasets](https://github.com/Wasp-Framework/Wasp-Atlas)

## Credits

- Roger Winkler — [rogerwinkler.de](https://www.rogerwinkler.de)
- Andrea Rossi — [thecomputationalhive.com](https://thecomputationalhive.com/)

Based on the original [WASP](https://github.com/ar0551/Wasp) Grasshopper plug-in by Andrea Rossi.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
