import type { Place, View } from '../lib/types';

export function readRecent(): Place[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('partyfinder.recent') || '[]');
    if (Array.isArray(stored))
      return stored
        .filter((x): x is Place => x && typeof x.path === 'string' && typeof x.name === 'string')
        .slice(0, 5);
  } catch {
    /* local preferences are optional */
  }
  return [];
}
export function writeRecent(next: Place[]) {
  try {
    localStorage.setItem('partyfinder.recent', JSON.stringify(next));
  } catch {
    /* optional */
  }
}
export function clearRecent() {
  try {
    localStorage.removeItem('partyfinder.recent');
  } catch {
    /* optional */
  }
}
export function readView(): View {
  try {
    return localStorage.getItem('partyfinder.view') === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}
export function writeView(view: View) {
  try {
    localStorage.setItem('partyfinder.view', view);
  } catch {
    /* optional */
  }
}
