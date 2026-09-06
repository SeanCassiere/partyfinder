import { useEffect, useState } from 'react';
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
    const params = new URLSearchParams();
    if (value.path !== '/') params.set('path', value.path);
    if (value.q) params.set('q', value.q);
    if (!value.recursive) params.set('recursive', 'false');
    if (value.limit !== 250) params.set('limit', String(value.limit));
    history.pushState(null, '', '/' + (params.size ? '?' + params : ''));
    setRoute(value);
    if ('q' in next || 'path' in next) setDraft(value.q);
  }
  function openFolder(path: string) {
    navigate({ path, q: '', limit: 250 });
  }

  return { route, draft, setDraft, navigate, openFolder };
}
