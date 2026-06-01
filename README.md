# webwaspjs

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
const exported = aggregation.toData();

console.log(Object.keys(aggregation.parts));
console.log(aggregation.rules.length);
console.log(JSON.stringify(exported));
```

Main entry points:

- `createAggregationFromData(data)` to rebuild an aggregation from serialized data
- `aggregation.toData()` to export the full current aggregation state as JSON-friendly data
- `Aggregation` for direct access to the core model
- `Visualizer` for simple browser rendering

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
src/        library source
tests/      vitest suite
examples/   JSON fixtures used by tests
dist/       build output
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
