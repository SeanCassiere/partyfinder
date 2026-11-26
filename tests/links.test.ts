import assert from 'node:assert/strict';
import test from 'node:test';
import { entryPermissions } from '../shared/permissions.js';
import {
  copypartyFolderUrl,
  copypartyRevealUrl,
  folderRoute,
  routeHref,
} from '../src/lib/links.js';

test('folder links carry the same URL that openFolder pushes', () => {
  const current = { path: '/media', q: 'old', recursive: false, limit: 1000 };
  assert.equal(routeHref(folderRoute(current, '/')), '/?recursive=false');
  assert.equal(
    routeHref(folderRoute({ ...current, recursive: true }, '/media/Movies & TV')),
    '/?path=%2Fmedia%2FMovies+%26+TV',
  );
});

test('Copyparty folder and reveal URLs encode paths and text-fragment reserved characters', () => {
  const base = 'https://files.example.com/cp/';
  assert.equal(copypartyFolderUrl(base, '/'), base);
  assert.equal(copypartyFolderUrl(base, '/media/A #1'), `${base}media/A%20%231/`);
  assert.equal(
    copypartyRevealUrl(base, '/media', 'Spider-Man, Part 1 & 2.mkv'),
    `${base}media/#:~:text=Spider%2DMan%2C%20Part%201%20%26%202.mkv`,
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
