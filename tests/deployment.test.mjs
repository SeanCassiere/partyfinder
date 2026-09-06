import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('the copy-paste deployment example matches the default published-image Compose file', async () => {
  const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8');
  for (const path of ['README.md', 'docs/deployment.md']) {
    const document = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    const example = document.match(/```yaml\n([\s\S]*?)\n```/);
    assert.ok(example, `${path} must include a complete Compose example`);
    assert.equal(example[1].trim(), compose.trim(), `${path} must match the deployment file`);
  }
  assert.match(compose, /image: seancassiere\/partyfinder:\$\{PARTYFINDER_VERSION:-1\.0\.0\}/);
  assert.doesNotMatch(compose, /^\s+build:/m);
});

test('documentation links resolve after splitting the README into focused guides', async () => {
  for (const path of [
    'README.md',
    'docs/deployment.md',
    'docs/usage.md',
    'docs/development.md',
    'docs/publishing.md',
  ]) {
    const source = new URL(`../${path}`, import.meta.url);
    const document = await readFile(source, 'utf8');
    for (const [, target] of document.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      const destination = new URL(target, source);
      destination.hash = '';
      await access(destination);
    }
  }
});

test('building from source requires the explicit development override', async () => {
  const compose = await readFile(new URL('../docker-compose.build.yml', import.meta.url), 'utf8');
  assert.match(compose, /^\s+build: \.$/m);
  assert.match(compose, /^\s+image: partyfinder:local$/m);
  assert.match(compose, /^\s+pull_policy: build$/m);
});
