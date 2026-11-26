import { useEffect, useState } from 'react';
import { folderRoute, routeHref } from '../lib/links';
import type { Route } from '../lib/types';

export function readLocation(): Route {
  const params = new URLSearchParams(location.search);
  return {
    path: params.get('path') || '/',
    q: params.get('q') || '',
    recursive: params.get('recursive') !== 'false',
    limit: Math.min(8000, Math.max(250, Number(params.get('limit')) || 250)),
  };
}

/**
 * Owns the URL-backed route, the search draft, and history integration.
 * `onNavigate` runs before every programmatic navigation (App uses it to close the entry menu).
 */
export function useRoute(onNavigate: () => void) {
  const [route, setRoute] = useState(readLocation);
  const [draft, setDraft] = useState(route.q);

  // SC 2.4.2: every route change renames the page, so history and tab lists stay meaningful.
  useEffect(() => {
    const folder = route.path === '/' ? 'All files' : (route.path.split('/').at(-1) ?? 'All files');
    document.title = route.q
      ? `Search “${route.q}” in ${folder} – Partyfinder`
      : `${folder} – Partyfinder`;
  }, [route.path, route.q]);

  useEffect(() => {
    const pop = () => {
      const next = readLocation();
      setRoute(next);
      setDraft(next.q);
    };
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);

  function navigate(next: Partial<Route>) {
    onNavigate();
    const value = { ...route, ...next };
    history.pushState(null, '', routeHref(value));
    setRoute(value);
    if ('q' in next || 'path' in next) setDraft(value.q);
  }
  function openFolder(path: string) {
    navigate(folderRoute(route, path));
  }

  return { route, draft, setDraft, navigate, openFolder };
}
