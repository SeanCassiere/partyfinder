import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transformSync } from 'oxc-transform-react';
import { format } from 'oxfmt';

test('the pinned native React Compiler optimizes every UI module without skipped-component diagnostics', async () => {
  for (const filename of ['App.tsx', 'EntryMenu.tsx', 'ThemePicker.tsx']) {
    const source = await readFile(new URL(`../src/${filename}`, import.meta.url), 'utf8');
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
