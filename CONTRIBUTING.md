# Contributing

## Setup

Requires [Bun](https://bun.sh).

```sh
bun install
```

## Scripts

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `bun run test`       | Run the unit tests (Vitest)                       |
| `bun run build`      | Bundle `src/index.ts` and emit types into `dist/` |
| `bun run format`     | Check formatting and lint (Biome)                 |
| `bun run format:fix` | Apply Biome formatting and lint fixes             |

CI runs `format`, `build` and `test` on every push to `main`.

## Releasing

```sh
bun run release 0.4.0
```

This bumps the version, tags it and pushes. The tag triggers the release workflow, which
publishes to npm and creates the GitHub release.
