#!/usr/bin/env node
// Fork releases (see FORK.md) are tagged "<upstream version>-fork.<n>", e.g.
// 0.3.9-fork.1. The tag carries the version: main keeps upstream's version
// fields untouched so upstream release bumps merge without conflicts, and the
// release job stamps the tag's version into them just before building.
//
//   node scripts/fork-release-version.mjs 0.3.9-fork.1
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2] ?? '';
const match = /^(\d+\.\d+\.\d+)-fork\.([1-9]\d*)$/.exec(version);
if (!match) fail(`"${version}" is not a fork release version like 0.3.9-fork.1.`);

const upstreamVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (match[1] !== upstreamVersion) {
  fail(`${version} must build on the merged upstream version ${upstreamVersion}.`);
}

updateJsonFile('package.json', (json) => {
  json.version = version;
});
updateJsonFile('package-lock.json', (json) => {
  json.version = version;
  if (json.packages?.['']) json.packages[''].version = version;
});
updateJsonFile('public/manifest.json', (json) => {
  json.version = version;
});
console.log(`ok - stamped version ${version}`);

function updateJsonFile(filePath, mutate) {
  const json = JSON.parse(readFileSync(filePath, 'utf8'));
  mutate(json);
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

function fail(message) {
  console.error(`not ok - ${message}`);
  process.exit(1);
}
