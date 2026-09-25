# Ordnance Survey Grid References Converter

Convert between Ordnance Survey (OSGB36) grid references and WGS84 latitude/longitude.

The conversion is implemented from first principles against the Ordnance Survey's published
constants — no runtime dependencies:

1. Grid reference string → Easting/Northing (100 km square lookup on the OS letter grid)
2. Easting/Northing → OSGB36 lat/lon (inverse Transverse Mercator on the Airy 1830 ellipsoid)
3. OSGB36 → WGS84 (Helmert 7-parameter datum transform, via geodetic ↔ Cartesian)

…and the same chain in reverse for WGS84 → grid reference.

### Accuracy

The Helmert transform is an approximation of the OSGB36/WGS84 relationship, accurate to
roughly **±2–5 m** across Great Britain. If you need sub-metre accuracy, use Ordnance Survey's
OSTN15 transformation grid instead.

## Setup

Requires [Bun](https://bun.sh).

```sh
bun install
```

### Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `bun run test`       | Run the unit tests (Vitest)          |
| `bun run build`      | Bundle `src/index.ts` into `dist/`   |
| `bun run format`     | Check formatting (Prettier) and lint |
| `bun run format:fix` | Apply Prettier and ESLint fixes      |

CI runs `format` and `test` on every push to `main`; publishing to npm happens on GitHub release.

### Using it as a dependency

```sh
bun add os-grid-refs-to-wgs-84   # or: npm install os-grid-refs-to-wgs-84
```

## Usage

### Grid reference → WGS84

`gridRefToWgs84` accepts any standard grid reference form — spaced or unspaced, 2 to 10 digits.

```ts
import { gridRefToWgs84 } from "os-grid-refs-to-wgs-84";

gridRefToWgs84("TL 44982 57869");
// { lat: 52.19999173938885, lon: 0.11998992997319333 }

gridRefToWgs84("TQ3838102501");
// { lat: 50.80554715939954, lon: -0.03745199724984742 }
```

Fewer digits means a coarser square. The reference resolves to the square's south-west corner,
and letters alone resolve to the centre of the 100 km square.

### WGS84 → grid reference

```ts
import { wgs84ToGridRef } from "os-grid-refs-to-wgs-84";

wgs84ToGridRef(52.199991739388686, 0.119989929973185);
// "TL 44982 57869"

wgs84ToGridRef(52.199991739388686, 0.119989929973185, 6);
// "TL 449 578"
```

The third argument is the total number of digits (even, 2–10; defaults to 10 for 1 m precision).
Coordinates that fall outside the OS grid return `null`:

```ts
wgs84ToGridRef(-33.9, 151.2); // null
```

### Validating input

```ts
import { isValidOsGridRef } from "os-grid-refs-to-wgs-84";

isValidOsGridRef("TL 44982 57869"); // true
isValidOsGridRef("TQ383810250"); // false — odd number of digits
isValidOsGridRef("IL 1234 5678"); // false — 'I' is not a grid letter
```

Note that this checks the _shape_ of the reference, not whether it lands on dry land in
Great Britain.

### Working with Easting/Northing

If your data is already in OS Easting/Northing metres, skip the string parsing:

```ts
import { parseGridRef, osGridToWgs84 } from "os-grid-refs-to-wgs-84";

parseGridRef("TL 44982 57869");
// { easting: 544982, northing: 257869 }

osGridToWgs84(544982, 257869);
// { lat: 52.19999173938885, lon: 0.11998992997319333 }
```

### Distance between two points

A Haversine helper is included, handy for checking how far apart two conversions land:

```ts
import { haversineMeters } from "os-grid-refs-to-wgs-84";

haversineMeters(52.2, 0.12, 52.201, 0.12); // 111.19492664429958 (metres)
```

## API

| Function                                  | Returns                           |
| ----------------------------------------- | --------------------------------- |
| `gridRefToWgs84(gridRef)`                 | `{ lat, lon }` in decimal degrees |
| `wgs84ToGridRef(lat, lon, digits = 10)`   | Grid reference string, or `null`  |
| `osGridToWgs84(easting, northing)`        | `{ lat, lon }` in decimal degrees |
| `parseGridRef(gridRef)`                   | `{ easting, northing }` in metres |
| `isValidOsGridRef(gridRef)`               | `boolean`                         |
| `haversineMeters(lat1, lon1, lat2, lon2)` | Distance in metres                |

Lower-level building blocks (`osEastNorthToLatLonOSGB36`, `latLonToOsEastNorth`,
`helmertOsToWgs`, `helmertWgsToOs`, `latLonToCartesian`, `cartesianToLatLon`) are also exported
if you need to assemble a different pipeline.

`parseGridRef` throws on malformed input — call `isValidOsGridRef` first when handling
untrusted data.

## Licence

MIT — see [LICENSE](LICENSE).
