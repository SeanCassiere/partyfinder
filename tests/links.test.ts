import assert from 'node:assert/strict';
import test from 'node:test';
import { entryPermissions } from '../shared/permissions.js';
import { folderRoute, routeHref } from '../src/lib/links.js';

test('folder links carry the same URL that openFolder pushes', () => {
  const current = { path: '/media', q: 'old', recursive: false, limit: 1000 };
  assert.equal(routeHref(folderRoute(current, '/')), '/?recursive=false');
  assert.equal(
    routeHref(folderRoute({ ...current, recursive: true }, '/media/Movies & TV')),
    '/?path=%2Fmedia%2FMovies+%26+TV',
  );
});

test('entry permissions follow Copyparty perms without a request', () => {
  const all = ['read', 'write', 'move', 'delete'];
  assert.deepEqual(
    { ...entryPermissions({ path: '/media/a.mkv', kind: 'file' }, all), reason: '' },
    { rename: true, delete: true, reason: '' },
  );
  const readOnly = entryPermissions({ path: '/media/a.mkv', kind: 'file' }, ['read']);
  assert.equal(readOnly.rename || readOnly.delete, false);
  const folder = entryPermissions({ path: '/media/dir', kind: 'directory' }, all);
  assert.equal(folder.rename, true);
  assert.equal(folder.delete, false, 'folder delete stays off unless the operator enables it');
  assert.equal(
    entryPermissions({ path: '/media/dir', kind: 'directory' }, all, all, true).delete,
    true,
  );
  const top = entryPermissions({ path: '/media', kind: 'directory' }, all);
  assert.equal(top.rename || top.delete, false, 'volumes are protected');
});
