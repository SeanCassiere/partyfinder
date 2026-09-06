import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the copy-paste deployment example matches the default published-image Compose file', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8');
  const example = readme.match(/```yaml\n([\s\S]*?)\n```/);
  assert.ok(example, 'README must include a complete Compose example');
  assert.equal(example[1].trim(), compose.trim());
  assert.match(compose, /image: seancassiere\/partyfinder:\$\{PARTYFINDER_VERSION:-1\.0\.0\}/);
  assert.doesNotMatch(compose, /^\s+build:/m);
});

test('building from source requires the explicit development override', async () => {
  const compose = await readFile(new URL('../docker-compose.build.yml', import.meta.url), 'utf8');
  assert.match(compose, /^\s+build: \.$/m);
  assert.match(compose, /^\s+image: partyfinder:local$/m);
  assert.match(compose, /^\s+pull_policy: build$/m);
});
