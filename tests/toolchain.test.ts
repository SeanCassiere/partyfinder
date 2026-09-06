import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';
import { transformSync } from 'oxc-transform-react';
import { format } from 'oxfmt';

test('the pinned native React Compiler optimizes every UI module without skipped-component diagnostics', async () => {
  const src = new URL('../src/', import.meta.url);
  const entries = await readdir(src, { recursive: true, withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx') && entry.name !== 'main.tsx')
    .map((entry) => relative(src.pathname, join(entry.parentPath, entry.name)))
    .sort();
  assert.ok(filenames.length > 1, 'expected the UI to be split across several modules');
  for (const filename of filenames) {
    const source = await readFile(new URL(filename, src), 'utf8');
    const result = transformSync(filename, source, {
      reactCompiler: { target: '19' },
      jsx: { runtime: 'automatic' },
    });
    assert.equal(result.fatal, false, filename);
    assert.deepEqual(result.errors, [], filename);
    assert.match(result.code, /react\/compiler-runtime/, filename);
  }
});

test('Oxfmt sorts Tailwind utilities while preserving custom CSS classes', async () => {
  const config = JSON.parse(await readFile(new URL('../.oxfmtrc.json', import.meta.url), 'utf8'));
  const result = await format(
    'fixture.tsx',
    'const element = <div className="p-4 custom-panel flex" />;',
    config,
  );
  assert.deepEqual(result.errors, []);
  assert.match(result.code, /className="custom-panel flex p-4"/);
});
