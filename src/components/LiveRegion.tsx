import { useEffect, useState } from 'react';
import { plural } from '../lib/format';
import type { Entry } from '../../shared/types';

/**
 * The application's two permanently-mounted live regions (WCAG 2.1 SC 4.1.3).
 *
 * Both nodes are rendered for the whole life of the app so assistive technology
 * has them registered before anything is written into them — swapping a subtree
 * that *contains* a live region in and out is the classic reason announcements
 * are silently dropped. `useAnnouncer` clears each message shortly after it is
 * written so that repeating the same text announces again.
 */
export function LiveRegion({ polite, assertive }: { polite: string; assertive: string }) {
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}

export function useAnnouncer() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  useEffect(() => {
    if (!polite) return;
    const timer = setTimeout(() => setPolite(''), 1200);
    return () => clearTimeout(timer);
  }, [polite]);
  useEffect(() => {
    if (!assertive) return;
    const timer = setTimeout(() => setAssertive(''), 2000);
    return () => clearTimeout(timer);
  }, [assertive]);

  return { polite, assertive, announce: setPolite, announceError: setAssertive };
}

/* ------------------------------------------------------------------ *
 * The message catalogue. Every announcement in the app is built here.
 * ------------------------------------------------------------------ */

export function describeListing(entries: Entry[], folderName: string) {
  const folders = entries.filter((entry) => entry.kind === 'directory').length;
  return `${plural(folders, 'folder')}, ${plural(entries.length - folders, 'file')} in ${folderName}`;
}

export function describeResults(count: number, query: string) {
  return `${plural(count, 'result')} for “${query}”`;
}

export function describeFailure(folderName: string, message: string) {
  return `Could not load ${folderName}. ${message}`;
}

export function describeShownItems(shown: number, total: number) {
  return `Showing ${shown.toLocaleString()} of ${plural(total, 'item')}`;
}
