/** Semver parsing and precedence for release tags of the form v1.2.3 or v1.2.3-beta.1. */

const SEMVER =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

export type Version = {
  tag: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

/** Adds a leading v if the caller left it off. */
export function normaliseTag(input: string): string {
  return input.startsWith("v") ? input : `v${input}`;
}

export function parse(tag: string): Version | null {
  const match = SEMVER.exec(tag);
  if (!match) return null;
  return {
    tag,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

/** Semver precedence: returns <0, 0 or >0. A prerelease ranks below its release. */
export function compare(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (!a.prerelease.length || !b.prerelease.length) {
    return Number(!!b.prerelease.length) - Number(!!a.prerelease.length);
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const numeric = /^\d+$/.test(x) && /^\d+$/.test(y);
    if (numeric && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (!numeric && x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Highest version among the given tags, ignoring any that are not release tags. */
export function highest(tags: string[]): Version | undefined {
  return tags
    .map((tag) => parse(tag.trim()))
    .filter((version): version is Version => version !== null)
    .sort(compare)
    .at(-1);
}
