import type { MouseEvent } from 'react';
import type { Route } from './types';

/** The in-app URL for a route. `useRoute` reads the same shape back in `readLocation`. */
export function routeHref(route: Route) {
  const params = new URLSearchParams();
  if (route.path !== '/') params.set('path', route.path);
  if (route.q) params.set('q', route.q);
  if (!route.recursive) params.set('recursive', 'false');
  if (route.limit !== 250) params.set('limit', String(route.limit));
  return '/' + (params.size ? '?' + params : '');
}

/** The route `openFolder(path)` navigates to from `current`: a fresh listing, same search scope. */
export function folderRoute(current: Route, path: string): Route {
  return { ...current, path, q: '', limit: 250 };
}

/**
 * True for a plain primary click, the only one the app handles itself. Any
 * modifier (Cmd/Ctrl, Shift, Alt) or a non-primary button keeps the browser's
 * own behaviour: new tab, new window, download, and so on.
 */
export function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** A folder's page in Copyparty. `base` is the configured server URL, ending in `/`. */
export function copypartyFolderUrl(base: string, path: string) {
  const segments = path.split('/').filter(Boolean).map(encodeURIComponent);
  return base + segments.join('/') + (segments.length ? '/' : '');
}

/**
 * The file's folder in Copyparty, scrolled to and highlighting the file.
 *
 * Copyparty has no URL parameter that selects a row (its `#af-…`/`#gf-…`
 * hashes start playback or the lightbox instead), so this uses a browser text
 * fragment (`#:~:text=`). Browsers that support it scroll to the filename and
 * highlight it; others just open the folder. Copyparty never sees the
 * fragment, so it does not conflict with Copyparty's own hash handling.
 */
export function copypartyRevealUrl(base: string, path: string, name: string) {
  // Text directives reserve `-`, `,` and `&`; encodeURIComponent leaves `-` alone.
  const text = encodeURIComponent(name).replace(/-/g, '%2D');
  return `${copypartyFolderUrl(base, path)}#:~:text=${text}`;
}
