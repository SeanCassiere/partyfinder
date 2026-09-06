import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAGE_STEP,
  findTypeAheadMatch,
  moveIndex,
  startsWithBase,
} from '../src/hooks/useRovingFocus';

/* ------------------------------------------------------------------ *
 * Index math — the one-dimensional list view (columns = 1).
 * ------------------------------------------------------------------ */

const list = { index: 5, count: 20, columns: 1 };

test('arrow keys move one row at a time in list view', () => {
  assert.equal(moveIndex('ArrowDown', list), 6);
  assert.equal(moveIndex('ArrowUp', list), 4);
});

test('list view leaves left/right to the controls inside the row', () => {
  assert.equal(moveIndex('ArrowRight', list), null);
  assert.equal(moveIndex('ArrowLeft', list), null);
});

test('movement clamps at both ends instead of wrapping', () => {
  assert.equal(moveIndex('ArrowUp', { index: 0, count: 20, columns: 1 }), 0);
  assert.equal(moveIndex('ArrowDown', { index: 19, count: 20, columns: 1 }), 19);
  assert.equal(moveIndex('PageUp', { index: 3, count: 20, columns: 1 }), 0);
  assert.equal(moveIndex('PageDown', { index: 17, count: 20, columns: 1 }), 19);
});

test('Home and End reach the ends, with or without Ctrl', () => {
  assert.equal(moveIndex('Home', list), 0);
  assert.equal(moveIndex('End', list), 19);
  assert.equal(moveIndex('Home', { ...list, ctrlKey: true }), 0);
  assert.equal(moveIndex('End', { ...list, ctrlKey: true }), 19);
});

test('PageUp and PageDown move ten rows', () => {
  assert.equal(PAGE_STEP, 10);
  assert.equal(moveIndex('PageDown', list), 15);
  assert.equal(moveIndex('PageUp', { index: 15, count: 20, columns: 1 }), 5);
});

test('Ctrl with a plain arrow is not ours', () => {
  assert.equal(moveIndex('ArrowDown', { ...list, ctrlKey: true }), null);
});

test('unhandled keys and empty listings return null', () => {
  assert.equal(moveIndex('a', list), null);
  assert.equal(moveIndex('Enter', list), null);
  assert.equal(moveIndex('ArrowDown', { index: 0, count: 0, columns: 1 }), null);
});

/* ------------------------------------------------------------------ *
 * Index math — the two-dimensional card grid.
 * ------------------------------------------------------------------ */

test('grid view moves by the column count vertically and by one horizontally', () => {
  const grid = { index: 4, count: 10, columns: 4 };
  assert.equal(moveIndex('ArrowDown', grid), 8);
  assert.equal(moveIndex('ArrowUp', grid), 0);
  assert.equal(moveIndex('ArrowRight', grid), 5);
  assert.equal(moveIndex('ArrowLeft', grid), 3);
});

test('grid view clamps into the last, partly filled row', () => {
  const grid = { index: 6, count: 10, columns: 4 };
  assert.equal(moveIndex('ArrowDown', grid), 9);
  assert.equal(moveIndex('ArrowRight', { index: 9, count: 10, columns: 4 }), 9);
  assert.equal(moveIndex('ArrowLeft', { index: 0, count: 10, columns: 4 }), 0);
});

/* ------------------------------------------------------------------ *
 * Type-ahead. Base sensitivity, per code point — never charCodeAt.
 * ------------------------------------------------------------------ */

const names = [
  'Archive',
  'backups',
  'Movies',
  'Music',
  'Ölfilter — größe.mkv',
  'öffnen.txt',
  'zip',
];

test('a single character jumps to the next matching entry', () => {
  assert.equal(findTypeAheadMatch(names, 'm', -1), 2);
  assert.equal(findTypeAheadMatch(names, 'M', -1), 2);
});

test('repeating the same character cycles through its matches and wraps', () => {
  assert.equal(findTypeAheadMatch(names, 'm', 2), 3);
  assert.equal(findTypeAheadMatch(names, 'mm', 3), 2);
});

test('a longer buffer matches the whole prefix from the current row', () => {
  assert.equal(findTypeAheadMatch(names, 'mus', 0), 3);
  assert.equal(findTypeAheadMatch(names, 'back', 0), 1);
  assert.equal(findTypeAheadMatch(names, 'mox', 0), null);
});

test('non-ASCII names match case- and accent-insensitively (Ö)', () => {
  assert.equal(findTypeAheadMatch(names, 'Ö', -1), 4);
  assert.equal(findTypeAheadMatch(names, 'ö', -1), 4);
  assert.equal(findTypeAheadMatch(names, 'o', -1), 4, 'base sensitivity: o matches Ö');
  assert.equal(findTypeAheadMatch(names, 'ölf', 0), 4);
  assert.equal(findTypeAheadMatch(names, 'öff', 0), 5);
});

test('an empty buffer or an empty listing matches nothing', () => {
  assert.equal(findTypeAheadMatch(names, '', 0), null);
  assert.equal(findTypeAheadMatch([], 'a', 0), null);
});

test('prefix matching counts code points, so astral names are safe', () => {
  assert.ok(startsWithBase('日本語のファイル.mkv', '日本'));
  assert.ok(startsWithBase('🎬 trailer.mp4', '🎬'));
  assert.ok(!startsWithBase('🎬 trailer.mp4', '🎬🎬'));
  assert.ok(!startsWithBase('ab', 'abc'));
  assert.ok(!startsWithBase('anything', ''));
});
