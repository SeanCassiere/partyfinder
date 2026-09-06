import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { api } from './lib/api';
import { parentOf } from './lib/format';
import { clearRecent, readRecent, readView, writeView } from './hooks/usePreference';
import { useEntryMenu } from './hooks/useEntryMenu';
import { useListing } from './hooks/useListing';
import { useRoute } from './hooks/useRoute';
import { EmptyState, ErrorState, LoadingState } from './components/EmptyState';
import { EntryMenu } from './components/EntryMenu';
import { FileGrid } from './components/FileGrid';
import { FileList } from './components/FileList';
import {
  describeFailure,
  describeListing,
  describeResults,
  describeShownItems,
  LiveRegion,
  useAnnouncer,
} from './components/LiveRegion';
import { Login } from './components/Login';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Sidebar } from './components/Sidebar';
import { ContentFooter, LimitNotice, LoadMore, MoreResults } from './components/StatusBar';
import { Toast } from './components/Toast';
import { Toolbar } from './components/Toolbar';
import type { EntryActions } from './components/EntryRow';
import type { Connection, Place, Sort, View } from './lib/types';
import type { Entry } from '../shared/types';

export default function App() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<Place[]>(readRecent);
  const [startupError, setStartupError] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [descending, setDescending] = useState(false);
  const [view, setView] = useState<View>(readView);
  const [toast, setToast] = useState('');
  const [shortcuts, setShortcuts] = useState(false);
  const { menu, setMenu, contextProps, openMenuAt } = useEntryMenu();
  const { route, draft, setDraft, navigate, openFolder } = useRoute(() => setMenu(null));
  const searching = Boolean(route.q);
  const folderName = route.path === '/' ? 'All files' : route.path.split('/').at(-1)!;
  const {
    volumes,
    listing,
    results,
    busy,
    error,
    filter,
    setFilter,
    visibleCount,
    setVisibleCount,
    refresh,
    reset,
  } = useListing({ signedIn, route, folderName, setSignedIn, setRecent });
  const input = useRef<HTMLInputElement>(null);
  const { polite, assertive, announce, announceError } = useAnnouncer();

  // SC 4.1.3: every settled request is announced through the persistent regions.
  useEffect(() => {
    if (signedIn !== true || busy) return;
    if (error) announceError(describeFailure(folderName, error));
    else if (results) announce(describeResults(results.entries.length, route.q));
    else if (listing) announce(describeListing(listing.entries, folderName));
  }, [signedIn, busy, error, results, listing, folderName, route.q, announce, announceError]);

  useEffect(() => {
    Promise.all([api<Connection>('/api/config'), api<{ signedIn: boolean }>('/api/session')])
      .then(([config, session]) => {
        setConnection(config);
        setSignedIn(session.signedIn);
      })
      .catch((error) => setStartupError(error.message));
  }, []);

  function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    if (draft.trim()) {
      navigate({ q: draft, limit: 250 });
      refresh();
    } else navigate({ q: '', limit: 250 });
  }
  // A11y-32. One document-level handler, registered once per dependency change
  // rather than on every render, and deliberately timid: it never competes with
  // a component that already acted, with text entry, or with an open layer.
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      // Something nearer the event already handled it, or an IME is composing.
      if (signedIn !== true) return;
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      // The entry menu and the modal dialogs own every key while they are open.
      if (menu || shortcuts) return;
      if (target?.closest('[role="menu"], dialog[open]')) return;

      const typing =
        target !== null &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

      if (event.key === '/' && !typing) {
        event.preventDefault();
        input.current?.focus();
        return;
      }
      if (event.key === '?' && !typing) {
        event.preventDefault();
        setShortcuts(true);
        return;
      }
      if (event.key === 'Escape') {
        // Scoped: Escape belongs to the search, and only while there is a search
        // to clear. Everywhere else it stays the browser's key.
        const inSearch = target !== null && target.closest('.search-form') !== null;
        if (!inSearch && !route.q) return;
        if (!draft && !route.q) return;
        event.preventDefault();
        navigate({ q: '', limit: 250 });
        return;
      }
      if (event.altKey && event.key === 'ArrowUp' && route.path !== '/') {
        event.preventDefault();
        openFolder(parentOf(route.path));
      }
    };
    addEventListener('keydown', keydown);
    return () => removeEventListener('keydown', keydown);
  }, [signedIn, menu, shortcuts, draft, route.q, route.path, navigate, openFolder]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  function changeSort(value: Sort) {
    if (sort === value) setDescending(!descending);
    else {
      setSort(value);
      setDescending(false);
    }
  }
  function chooseView(next: View) {
    setView(next);
    writeView(next);
  }
  async function logout() {
    try {
      await api('/api/session', { method: 'DELETE' });
      setSignedIn(false);
      reset();
      setRecent([]);
      clearRecent();
    } catch (error) {
      setToast((error as Error).message);
    }
  }
  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copied');
    } catch {
      setToast('Clipboard unavailable. Open the file in Copyparty to copy its link.');
    }
  }
  function download(entry: Entry) {
    return `/api/file?path=${encodeURIComponent(entry.path)}${entry.key ? '&key=' + encodeURIComponent(entry.key) : ''}`;
  }

  if (startupError)
    return (
      <main className="boot">
        <div className="error-box" role="alert">
          {startupError}
        </div>
        <button className="primary" onClick={() => location.reload()}>
          Retry connection
        </button>
      </main>
    );
  if (signedIn === null)
    return (
      <main className="boot">
        <LoaderCircle className="spin" size={26} aria-hidden="true" />
        <p>Connecting to Partyfinder…</p>
      </main>
    );
  if (!signedIn) return <Login connection={connection} onConnect={() => setSignedIn(true)} />;

  const allEntries = results?.entries ?? listing?.entries ?? [];
  const entries = [...allEntries]
    .filter((e) => filter === 'all' || e.kind === filter)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      const order =
        sort === 'name'
          ? a.name.localeCompare(b.name, undefined, { numeric: true })
          : sort === 'size'
            ? a.size - b.size
            : a.modified - b.modified;
      return descending ? -order : order;
    });
  const folders = allEntries.filter((e) => e.kind === 'directory').length;
  const files = allEntries.length - folders;
  const crumbs = route.path.split('/').filter(Boolean);
  const visible = entries.slice(0, visibleCount);
  const actions: EntryActions = {
    searching,
    openFolder,
    openMenuAt,
    download,
    copyUrl,
    contextProps,
    menuPath: menu?.entry.path ?? null,
  };
  // Identity of the current listing; changing it parks the listing's roving focus back at the top.
  const listKey = `${route.path}|${route.q}|${route.recursive}|${filter}`;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to file list
      </a>
      <Sidebar
        route={route}
        volumes={volumes}
        recent={recent}
        connection={connection}
        openFolder={openFolder}
        onDisconnect={() => void logout()}
        onShowShortcuts={() => setShortcuts(true)}
      />

      <div className="main-shell">
        <Toolbar
          route={route}
          crumbs={crumbs}
          connection={connection}
          busy={busy}
          folderName={folderName}
          draft={draft}
          setDraft={setDraft}
          searching={searching}
          inputRef={input}
          onSubmit={submitSearch}
          navigate={navigate}
          filter={filter}
          setFilter={setFilter}
          setVisibleCount={setVisibleCount}
          view={view}
          setView={chooseView}
          sort={sort}
          descending={descending}
          changeSort={changeSort}
          openFolder={openFolder}
          onRefresh={refresh}
          onDisconnect={() => void logout()}
        />

        <main className="main-content" id="main" tabIndex={-1}>
          <h1 className="sr-only">{searching ? `Search results for “${route.q}”` : folderName}</h1>

          <section
            className={`file-panel ${view}`}
            aria-label={searching ? 'Search results' : 'Folder contents'}
            aria-busy={busy}
          >
            {busy ? (
              <LoadingState route={route} searching={searching} />
            ) : error ? (
              <ErrorState error={error} onRetry={refresh} openFolder={openFolder} />
            ) : entries.length === 0 ? (
              <EmptyState route={route} searching={searching} filter={filter} navigate={navigate} />
            ) : view === 'list' ? (
              <FileList
                entries={visible}
                total={entries.length}
                listKey={listKey}
                sort={sort}
                descending={descending}
                changeSort={changeSort}
                actions={actions}
              />
            ) : (
              <FileGrid
                entries={visible}
                total={entries.length}
                listKey={listKey}
                actions={actions}
              />
            )}
            {!busy && !error && entries.length > visibleCount && (
              <LoadMore
                remaining={entries.length - visibleCount}
                onShowMore={() => {
                  const next = Math.min(entries.length, visibleCount + 250);
                  setVisibleCount(next);
                  announce(describeShownItems(next, entries.length));
                }}
              />
            )}
          </section>

          {results?.more && !busy && (
            <MoreResults results={results} route={route} navigate={navigate} />
          )}
          {results?.capped && !busy && <LimitNotice />}
          <ContentFooter
            route={route}
            searching={searching}
            busy={busy}
            error={error}
            count={entries.length}
            folders={folders}
            files={files}
          />
        </main>
      </div>
      <Toast message={toast} onDismiss={() => setToast('')} />
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
      <LiveRegion polite={polite} assertive={assertive} />
      {menu && (
        <EntryMenu
          key={menu.entry.path}
          target={menu}
          onClose={() => setMenu(null)}
          onChanged={(message) => {
            setToast(message);
            refresh();
          }}
        />
      )}
    </div>
  );
}
