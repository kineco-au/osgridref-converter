import { describe, expect, it } from "vitest";
import { compare, highest, normaliseTag, parse } from "./version";

describe("normaliseTag", () => {
  it("adds a missing v prefix", () => {
    expect(normaliseTag("0.5.1")).toBe("v0.5.1");
  });

  it("leaves an existing v prefix alone", () => {
    expect(normaliseTag("v0.5.1")).toBe("v0.5.1");
  });
});

describe("parse", () => {
  it("parses a release tag", () => {
    expect(parse("v0.5.1")).toEqual({
      tag: "v0.5.1",
      major: 0,
      minor: 5,
      patch: 1,
      prerelease: [],
    });
  });

  it("parses a prerelease tag", () => {
    expect(parse("v1.0.0-beta.2")?.prerelease).toEqual(["beta", "2"]);
  });

  it.each([
    "0.5.1",
    "v1.2",
    "v1.2.3.4",
    "vx.y.z",
    "v01.2.3",
    "v1.2.3-",
    "release-1.2.3",
    "",
  ])("rejects %s", (tag) => {
    expect(parse(tag)).toBeNull();
  });
});

describe("compare", () => {
  const mustParse = (tag: string) => {
    const version = parse(tag);
    if (!version) throw new Error(`not a valid version tag: ${tag}`);
    return version;
  };

  const order = (a: string, b: string) =>
    Math.sign(compare(mustParse(a), mustParse(b)));

  it.each([
    ["v1.0.0", "v2.0.0"],
    ["v1.0.0", "v1.1.0"],
    ["v1.0.0", "v1.0.1"],
    ["v1.0.9", "v1.0.10"],
    ["v0.9.0", "v0.10.0"],
  ])("ranks %s below %s", (lower, higher) => {
    expect(order(lower, higher)).toBe(-1);
    expect(order(higher, lower)).toBe(1);
  });

  it("ranks a prerelease below its release", () => {
    expect(order("v1.0.0-beta.1", "v1.0.0")).toBe(-1);
  });

  it("ranks prereleases numerically then alphabetically", () => {
    expect(order("v1.0.0-beta.2", "v1.0.0-beta.10")).toBe(-1);
    expect(order("v1.0.0-alpha", "v1.0.0-beta")).toBe(-1);
  });

  it("ranks a shorter prerelease below a longer one with the same prefix", () => {
    expect(order("v1.0.0-beta", "v1.0.0-beta.1")).toBe(-1);
  });

  it("treats equal versions as equal", () => {
    expect(order("v1.2.3", "v1.2.3")).toBe(0);
    expect(order("v1.2.3-rc.1", "v1.2.3-rc.1")).toBe(0);
  });
});

describe("highest", () => {
  it("returns undefined when there are no tags", () => {
    expect(highest([])).toBeUndefined();
  });

  it("ignores tags that are not release tags", () => {
    expect(highest(["nightly", "v0.2.3", "not-a-tag"])?.tag).toBe("v0.2.3");
  });

  it("finds the highest version regardless of order", () => {
    expect(highest(["v0.10.0", "v0.9.9", "v0.2.3"])?.tag).toBe("v0.10.0");
  });

  it("prefers a release over its prereleases", () => {
    expect(highest(["v1.0.0-rc.1", "v1.0.0", "v0.9.0"])?.tag).toBe("v1.0.0");
  });
});
