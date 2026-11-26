import type { Entry } from './types.js';

export interface EntryPermissions {
  rename: boolean;
  delete: boolean;
  reason: string;
}

/** Server roots and top-level locations (volumes) are never renamed or deleted here. */
export function isProtectedPath(path: string) {
  return path === '/' || path.lastIndexOf('/') === 0;
}

/**
 * The one rule for what an entry's menu may offer. The server applies it before
 * every rename or delete; the browser applies it to permissions it already has
 * from the folder listing, so the menu needs no request to open.
 *
 * Copyparty permissions are per volume. `parent` is the permission list of the
 * folder containing the entry; `own` is the entry's own, which for a file is
 * always the parent's, and for a folder differs only when it is a separate
 * volume mounted inside this one.
 */
export function entryPermissions(
  entry: Pick<Entry, 'path' | 'kind'>,
  parent: readonly string[],
  own: readonly string[] = parent,
  allowFolderDelete = false,
): EntryPermissions {
  if (isProtectedPath(entry.path))
    return {
      rename: false,
      delete: false,
      reason: 'Server roots and top-level locations are protected.',
    };
  const read = own.includes('read');
  return {
    rename: read && own.includes('move') && parent.includes('write'),
    delete: read && own.includes('delete') && (entry.kind === 'file' || allowFolderDelete),
    reason:
      entry.kind === 'directory' && !allowFolderDelete
        ? 'Folder deletion is disabled by the app operator. Rename still follows Copyparty permissions.'
        : 'Actions follow your Copyparty permissions.',
  };
}
