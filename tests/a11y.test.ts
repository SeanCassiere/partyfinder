import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * Static accessibility guards.
 *
 * There is no renderer in this test runner (`tsx --test`, node built-ins only,
 * no new dependencies), so these checks read the JSX *source* of every UI module
 * under `src/` and look for the shapes that regress most often. They are
 * deliberately simple heuristics, not a11y validation:
 *
 *   1. Icon-only buttons must be labelled. A `<button>` counts as icon-only when
 *      its children contain a component whose name starts with a capital letter
 *      (i.e. a lucide icon), no string literal, and no visible text once tags and
 *      `{…}` expressions are removed. Such a button needs `aria-label` or
 *      `aria-labelledby`.
 *   2. Every `<th>` carries `scope`.
 *   3. `title=` is never an element's only name: the same element must also carry
 *      `aria-label`/`aria-labelledby`, or have visible text of its own.
 *   4. Every lucide icon rendered under its imported name carries `aria-hidden`
 *      (or sits inside an element that just set it — a short look-back).
 *   5. `src/styles` never removes a focus outline, unless the very next
 *      declaration puts a ring back.
 *
 * False negatives are accepted; a false positive means the heuristic needs a
 * comment here, not a silenced assertion.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');
const stylesDir = join(srcDir, 'styles');

function filesUnder(dir: string, extension: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full, extension);
    return name.endsWith(extension) ? [full] : [];
  });
}

const modules = filesUnder(srcDir, '.tsx').map((file) => ({
  name: file.slice(root.length),
  source: readFileSync(file, 'utf8'),
}));

/* ------------------------------------------------------------------ *
 * A tiny JSX tag scanner. Attribute lists contain `>` (arrow functions
 * in handlers), so the end of an opening tag has to be found by walking
 * the characters and tracking brace/quote depth rather than by regex.
 * ------------------------------------------------------------------ */

type Element = { tag: string; attrs: string; content: string; at: number };

function readOpenTag(source: string, from: number): { attrs: string; end: number; self: boolean } {
  let depth = 0;
  let quote = '';
  for (let index = from; index < source.length; index += 1) {
    const character = source[index]!;
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') quote = character;
    else if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    else if (character === '>' && depth === 0) {
      const self = source[index - 1] === '/';
      return { attrs: source.slice(from, self ? index - 1 : index), end: index + 1, self };
    }
  }
  return { attrs: source.slice(from), end: source.length, self: true };
}

/** Every `<tag …>…</tag>` (and self-closing `<tag …/>`) for one tag name. */
function elementsNamed(source: string, tag: string): Element[] {
  const found: Element[] = [];
  const opener = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  for (const match of source.matchAll(opener)) {
    const at = match.index;
    const open = readOpenTag(source, at + tag.length + 1);
    if (open.self) {
      found.push({ tag, attrs: open.attrs, content: '', at });
      continue;
    }
    const close = source.indexOf(`</${tag}>`, open.end);
    found.push({
      tag,
      attrs: open.attrs,
      content: close === -1 ? '' : source.slice(open.end, close),
      at,
    });
  }
  return found;
}

/** Text a sighted user would read: children with every tag removed. */
function visibleText(content: string): string {
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** As above, but `{…}` expressions are dropped too — used to spot icon-only buttons. */
function literalText(content: string): string {
  return visibleText(content.replace(/\{[^{}]*\}/g, ' '));
}

function isLabelled(attrs: string): boolean {
  return /\baria-label(ledby)?[=\s]/.test(attrs);
}

/* ------------------------------------------------------------------ *
 * 1. Icon-only buttons
 * ------------------------------------------------------------------ */

test('every icon-only button has an accessible name', () => {
  const offenders: string[] = [];
  for (const { name, source } of modules) {
    for (const element of elementsNamed(source, 'button')) {
      const iconOnly =
        /<[A-Z]\w*[\s/>]/.test(element.content) &&
        !/['"][^'"]+['"]/.test(element.content) &&
        literalText(element.content) === '';
      if (iconOnly && !isLabelled(element.attrs)) {
        offenders.push(`${name}: <button${element.attrs.replace(/\s+/g, ' ')}>`);
      }
    }
  }
  assert.deepEqual(offenders, [], `icon-only buttons need aria-label:\n${offenders.join('\n')}`);
});

/* ------------------------------------------------------------------ *
 * 2. Table headers
 * ------------------------------------------------------------------ */

test('every <th> declares a scope', () => {
  const offenders: string[] = [];
  for (const { name, source } of modules) {
    for (const element of elementsNamed(source, 'th')) {
      if (!/\bscope[=\s]/.test(element.attrs)) {
        offenders.push(`${name}: <th${element.attrs.replace(/\s+/g, ' ')}>`);
      }
    }
  }
  assert.deepEqual(offenders, [], `<th> needs scope="col":\n${offenders.join('\n')}`);
});

/* ------------------------------------------------------------------ *
 * 3. title= is a tooltip, never the only label
 * ------------------------------------------------------------------ */

test('title is never an element’s only accessible name', () => {
  const offenders: string[] = [];
  const tagged = /<([a-zA-Z][\w.]*)(?=[\s])/g;
  for (const { name, source } of modules) {
    for (const match of source.matchAll(tagged)) {
      const tag = match[1]!;
      const open = readOpenTag(source, match.index + tag.length + 1);
      if (!/\btitle=/.test(open.attrs)) continue;
      if (isLabelled(open.attrs)) continue;
      const close = open.self ? -1 : source.indexOf(`</${tag}>`, open.end);
      const content = close === -1 ? '' : source.slice(open.end, close);
      if (visibleText(content) === '') {
        offenders.push(`${name}: <${tag}${open.attrs.replace(/\s+/g, ' ')}>`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `title= needs a paired aria-label or visible text:\n${offenders.join('\n')}`,
  );
});

/* ------------------------------------------------------------------ *
 * 4. Decorative icons
 * ------------------------------------------------------------------ */

/** How far back an ancestor's `aria-hidden` still counts, in characters. */
const ANCESTOR_LOOKBACK = 220;

test('every lucide icon is hidden from assistive technology', () => {
  const offenders: string[] = [];
  for (const { name, source } of modules) {
    // `[^{}]` keeps the match from spanning an earlier import's braces.
    const imports = source.match(/import\s*\{([^{}]*)\}\s*from\s*'lucide-react';/);
    if (!imports) continue;
    const icons = imports[1]!
      .split(',')
      .map((entry) => entry.replace(/^\s*type\s+/, '').trim())
      .filter((entry) => /^[A-Z]\w*$/.test(entry));
    for (const icon of icons) {
      for (const element of elementsNamed(source, icon)) {
        if (/\baria-hidden/.test(element.attrs)) continue;
        const before = source.slice(Math.max(0, element.at - ANCESTOR_LOOKBACK), element.at);
        if (/aria-hidden/.test(before)) continue;
        offenders.push(`${name}: <${icon}${element.attrs.replace(/\s+/g, ' ')} />`);
      }
    }
  }
  assert.deepEqual(offenders, [], `decorative icons need aria-hidden:\n${offenders.join('\n')}`);
});

/* ------------------------------------------------------------------ *
 * 5. Focus outlines are never simply removed
 * ------------------------------------------------------------------ */

test('no stylesheet removes a focus outline without replacing the ring', () => {
  const offenders: string[] = [];
  for (const file of filesUnder(stylesDir, '.css')) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!/outline:\s*(none|0)\s*;/.test(line)) return;
      // The one legitimate pattern: strip the UA outline, then draw our own on
      // the very next declaration (a box-shadow ring or another outline).
      const next = lines[index + 1] ?? '';
      if (/(box-shadow|outline):/.test(next)) return;
      offenders.push(`${file.slice(root.length)}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], `focus must stay visible:\n${offenders.join('\n')}`);
});
