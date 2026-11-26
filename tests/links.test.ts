import assert from 'node:assert/strict';
import test from 'node:test';
import { folderRoute, routeHref } from '../src/lib/links.js';

test('folder links carry the same URL that openFolder pushes', () => {
  const current = { path: '/media', q: 'old', recursive: false, limit: 1000 };
  assert.equal(routeHref(folderRoute(current, '/')), '/?recursive=false');
  assert.equal(
    routeHref(folderRoute({ ...current, recursive: true }, '/media/Movies & TV')),
    '/?path=%2Fmedia%2FMovies+%26+TV',
  );
});
