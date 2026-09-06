import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api, ApiError } from '../lib/api';
import { writeRecent } from './usePreference';
import type { Place, Route } from '../lib/types';
import type { Entry, Listing, SearchResults } from '../../shared/types';

/**
 * Owns the listing/search request for the current route plus the per-request derived state.
 *
 * The `requestKey` pattern is deliberate: filter and visible-count are keyed by the request they
 * belong to, so they reset when the request changes without needing an effect. Do not "simplify"
 * it into effects.
 */
export function useListing({
  signedIn,
  route,
  folderName,
  setSignedIn,
  setRecent,
}: {
  signedIn: boolean | null;
  route: Route;
  folderName: string;
  setSignedIn: Dispatch<SetStateAction<boolean | null>>;
  setRecent: Dispatch<SetStateAction<Place[]>>;
}) {
  const [response, setResponse] = useState<{
    key: string;
    data?: Listing | SearchResults;
    error?: string;
  } | null>(null);
  const [volumes, setVolumes] = useState<Entry[]>([]);
  const [reload, setReload] = useState(0);
  const requestKey = JSON.stringify({ route, reload, signedIn });
  const data = response?.key === requestKey ? response.data : undefined;
  const listing = data && !('scanned' in data) ? data : null;
  const results = data && 'scanned' in data ? data : null;
  const busy = signedIn === true && response?.key !== requestKey;
  const error = response?.key === requestKey ? response.error || '' : '';
  const [filterState, setFilterState] = useState({ key: '', value: 'all' });
  const filter = filterState.key === requestKey ? filterState.value : 'all';
  const setFilter = (value: string) => setFilterState({ key: requestKey, value });
  const [visibleState, setVisibleState] = useState({ key: '', value: 250 });
  const visibleCount = visibleState.key === requestKey ? visibleState.value : 250;
  const setVisibleCount = (value: number) => setVisibleState({ key: requestKey, value });

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    api<Listing>('/api/list?path=%2F', { signal: controller.signal })
      .then((data) => setVolumes(data.entries.filter((e) => e.kind === 'directory')))
      .catch(() => {});
    return () => controller.abort();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    const request = route.q
      ? api<SearchResults>('/api/search', {
          method: 'POST',
          body: JSON.stringify(route),
          signal: controller.signal,
        })
      : api<Listing>(`/api/list?path=${encodeURIComponent(route.path)}`, {
          signal: controller.signal,
        });
    request
      .then((data) => {
        if (controller.signal.aborted) return;
        setResponse({ key: requestKey, data });
        if (route.path !== '/')
          setRecent((previous) => {
            const next = [
              { path: route.path, name: folderName },
              ...previous.filter((p) => p.path !== route.path),
            ].slice(0, 5);
            writeRecent(next);
            return next;
          });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) setSignedIn(false);
        else setResponse({ key: requestKey, error: error.message });
      });
    return () => controller.abort();
  }, [signedIn, route, requestKey, folderName, setRecent, setSignedIn]);

  return {
    volumes,
    listing,
    results,
    busy,
    error,
    filter,
    setFilter,
    visibleCount,
    setVisibleCount,
    refresh: () => setReload((n) => n + 1),
    reset: () => {
      setVolumes([]);
      setResponse(null);
    },
  };
}
