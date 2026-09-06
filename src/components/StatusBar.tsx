import { plural } from '../lib/format';
import type { Route } from '../lib/types';
import type { SearchResults } from '../../shared/types';

export function LoadMore({ remaining, onShowMore }: { remaining: number; onShowMore: () => void }) {
  return (
    <div className="load-more">
      <button type="button" className="secondary" onClick={onShowMore}>
        {remaining <= 250
          ? `Show the remaining ${plural(remaining, 'item')}`
          : `Show 250 more of ${plural(remaining, 'hidden item')}`}
      </button>
    </div>
  );
}

export function MoreResults({
  results,
  route,
  navigate,
}: {
  results: SearchResults;
  route: Route;
  navigate: (next: Partial<Route>) => void;
}) {
  const next = Math.min(8000, route.limit * 2);
  return (
    <div className="more-results">
      <span>
        {plural(results.entries.length, 'match', 'matches')} from {results.scanned.toLocaleString()}{' '}
        candidates. More may be available.
      </span>
      <button type="button" className="secondary" onClick={() => navigate({ limit: next })}>
        Search for up to {next.toLocaleString()} results
      </button>
    </div>
  );
}

export function LimitNotice() {
  return (
    <p className="limit-notice">
      The server’s result limit may have been reached. Narrow your phrase or choose a deeper folder
      to find more.
    </p>
  );
}

/**
 * The single status line under the content. Counts here are mirrored into the
 * polite live region by `App` (see `describeListing` / `describeResults`), so
 * this element deliberately carries no live semantics of its own.
 */
export function ContentFooter({
  route,
  searching,
  busy,
  error,
  count,
  folders,
  files,
}: {
  route: Route;
  searching: boolean;
  busy: boolean;
  error: string;
  count: number;
  folders: number;
  files: number;
}) {
  const status = busy
    ? ''
    : error
      ? 'Not loaded'
      : searching
        ? plural(count, 'result')
        : `${plural(folders, 'folder')}, ${plural(files, 'file')}`;
  return (
    <footer className="content-footer">
      <span>{status}</span>
      {searching && route.recursive && !busy && !error && <span>Indexed files only</span>}
    </footer>
  );
}
