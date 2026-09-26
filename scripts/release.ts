#!/usr/bin/env bun
/** Bumps the package version, tags it and pushes, which triggers the release workflow. */
import { $ } from "bun";
import { compare, highest, normaliseTag, parse } from "./version";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const input = process.argv[2];
if (!input)
  fail("usage: bun run release <version>   e.g. bun run release 0.5.1");

const tag = normaliseTag(input);
const version = parse(tag);
if (!version)
  fail(`'${tag}' is not a valid semver version (expected e.g. v0.5.1)`);

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== "main")
  fail(`must be on main to release, currently on '${branch}'`);
console.log("✓ on main");

if ((await $`git status --porcelain`.text()).trim())
  fail("working tree has uncommitted changes, commit or stash them first");
console.log("✓ working tree clean");

console.log(`✓ ${tag} is valid semver`);

await $`git fetch --tags --quiet origin`.quiet();
const tags = (await $`git tag -l`.text()).split("\n");
if (tags.some((existing) => existing.trim() === tag))
  fail(`${tag} has already been released`);

const latest = highest(tags);
if (latest && compare(version, latest) < 0)
  fail(`${tag} is lower than the latest release ${latest.tag}`);
console.log(`✓ ${tag} not already released (latest: ${latest?.tag ?? "none"})`);

const nextVersion = tag.slice(1);
const packageJson = await Bun.file("package.json").text();
const currentVersion = JSON.parse(packageJson).version as string;

await Bun.write(
  "package.json",
  packageJson.replace(/("version":\s*)"[^"]*"/, `$1"${nextVersion}"`),
);
console.log(`→ package.json ${currentVersion} → ${nextVersion}`);

const readme = await Bun.file("README.md").text();
if (readme.includes(currentVersion)) {
  await Bun.write("README.md", readme.replaceAll(currentVersion, nextVersion));
  console.log(`→ README.md ${currentVersion} → ${nextVersion}`);
}

await $`git commit --all --message ${`bump version to ${tag}`}`.quiet();
console.log(`→ commit "bump version to ${tag}"`);

await $`git tag --annotate ${tag} --message ${tag}`.quiet();
console.log(`→ tag ${tag}`);

await $`git push origin main --follow-tags`.quiet();
console.log("→ push origin main --follow-tags");
