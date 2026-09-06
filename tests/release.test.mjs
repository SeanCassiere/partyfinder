import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import { generateNotes } from '@semantic-release/release-notes-generator';

const config = JSON.parse(await readFile(new URL('../.releaserc.json', import.meta.url), 'utf8'));
const optionsFor = (name) => config.plugins.find((plugin) => plugin[0] === name)[1];
const context = {
  cwd: process.cwd(),
  logger: { log() {} },
  options: { repositoryUrl: 'https://github.com/SeanCassiere/partyfinder' },
  commits: [
    { hash: 'a'.repeat(40), message: 'feat: add file search' },
    { hash: 'b'.repeat(40), message: 'fix: preserve search scope' },
  ],
  lastRelease: {},
  nextRelease: { version: '1.0.0', gitTag: 'v1.0.0', gitHead: 'b'.repeat(40) },
};

test('the installed release preset renders first-release and subsequent release notes', async () => {
  const options = optionsFor('@semantic-release/release-notes-generator');
  const initial = await generateNotes(options, context);
  assert.match(initial, /1\.0\.0/);
  assert.match(initial, /add file search/);
  assert.match(initial, /preserve search scope/);
  const next = await generateNotes(options, {
    ...context,
    lastRelease: { gitTag: 'v1.0.0', gitHead: 'a'.repeat(40) },
    nextRelease: { version: '1.1.0', gitTag: 'v1.1.0', gitHead: 'b'.repeat(40) },
  });
  assert.match(next, /compare\/v1\.0\.0\.\.\.v1\.1\.0/);
});

test('release rules distinguish features, fixes, dependency updates and non-release commits', async () => {
  for (const [message, expected] of [
    ['feat: add searching', 'minor'],
    ['fix: preserve search', 'patch'],
    ['refactor: simplify navigation', 'patch'],
    ['build(deps): update compiler', 'patch'],
    ['feat!: change API', 'major'],
    ['docs: clarify deployment', null],
  ]) {
    assert.equal(
      await analyzeCommits(optionsFor('@semantic-release/commit-analyzer'), {
        ...context,
        commits: [{ hash: 'c'.repeat(40), message }],
      }),
      expected,
      message,
    );
  }
});
