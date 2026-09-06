import { useEffect, useState } from 'react';
import type { Route } from '../lib/types';

function folderLabel(path: string) {
  return path === '/' ? 'All files' : path.split('/').at(-1)!;
}

/**
 * A text-only busy state. It stays blank for the first 300ms so a fast listing
 * never flashes a loading message, and it is a `role="status"` so the delayed
 * text is announced when it does appear (A11y-16).
 */
export function LoadingState({ route, searching }: { route: Route; searching: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 300);
    return () => clearTimeout(timer);
  }, []);
  return (
    <p className="empty-state" role="status">
      {shown ? (searching ? `Searching “${route.q}”…` : 'Loading…') : ''}
    </p>
  );
}

export function ErrorState({
  error,
  onRetry,
  openFolder,
}: {
  error: string;
  onRetry: () => void;
  openFolder: (path: string) => void;
}) {
  return (
    <div className="empty-state">
      <p role="alert">{error}</p>
      <div className="empty-actions">
        <button type="button" className="secondary" onClick={onRetry}>
          Retry
        </button>
        <button type="button" className="secondary" onClick={() => openFolder('/')}>
          Go to all files
        </button>
      </div>
    </div>
  );
}

export function EmptyState({
  route,
  searching,
  filter,
  navigate,
}: {
  route: Route;
  searching: boolean;
  filter: string;
  navigate: (next: Partial<Route>) => void;
}) {
  const folder = folderLabel(route.path);
  const message = searching
    ? `No results for “${route.q}” in ${folder}.`
    : filter === 'directory'
      ? `No folders in ${folder}.`
      : filter === 'file'
        ? `No files in ${folder}.`
        : 'This folder is empty.';
  return (
    <div className="empty-state">
      <p>{message}</p>
      <div className="empty-actions">
        {searching && !route.recursive && (
          <button type="button" className="secondary" onClick={() => navigate({ recursive: true })}>
            Search subfolders
          </button>
        )}
        {searching && (
          <button
            type="button"
            className="secondary"
            onClick={() => navigate({ q: '', limit: 250 })}
          >
            Clear search
          </button>
        )}
        {!searching && route.path !== '/' && (
          <button
            type="button"
            className="secondary"
            onClick={() => navigate({ path: '/', q: '', limit: 250 })}
          >
            Go to all files
          </button>
        )}
      </div>
    </div>
  );
}
