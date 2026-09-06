import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  List,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { api, ApiError } from './api';
import { ThemePicker } from './ThemePicker';
import { EntryMenu, type MenuTarget } from './EntryMenu';
import type { Entry, Listing, SearchResults } from '../shared/types';

type Connection = { server: string; url: string };
type Place = { path: string; name: string };
type Sort = 'name' | 'size' | 'modified';

function readRecent(): Place[] {
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
function readView(): 'list' | 'grid' {
  try {
    return localStorage.getItem('partyfinder.view') === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function readLocation() {
  const params = new URLSearchParams(location.search);
  return {
    path: params.get('path') || '/',
    q: params.get('q') || '',
    recursive: params.get('recursive') !== 'false',
    limit: Math.min(8000, Math.max(250, Number(params.get('limit')) || 250)),
  };
}
function parentOf(path: string) {
  return path.slice(0, path.lastIndexOf('/')) || '/';
}
function bytes(size: number) {
  if (!size) return '0 B';
  const power = Math.min(4, Math.floor(Math.log(size) / Math.log(1024)));
  return `${(size / 1024 ** power).toLocaleString(undefined, { maximumFractionDigits: power ? 1 : 0 })} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][power]}`;
}
function fileKind(entry: Entry) {
  if (entry.kind === 'directory') return 'Folder';
  const ext = entry.name.split('.').at(-1)?.toLowerCase() ?? '';
  return ext === entry.name.toLowerCase() ? 'File' : `${ext.toUpperCase()} file`;
}
function EntryIcon({ entry }: { entry: Entry }) {
  const ext = entry.name.split('.').at(-1)?.toLowerCase() ?? '';
  const Icon =
    entry.kind === 'directory'
      ? Folder
      : /^(mp4|mkv|avi|mov|webm|m4v)$/.test(ext)
        ? FileVideo
        : /^(mp3|flac|wav|opus|m4a|ogg)$/.test(ext)
          ? FileAudio
          : /^(png|jpg|jpeg|svg|webp|avif|gif)$/.test(ext)
            ? FileImage
            : /^(zip|7z|tar|gz|rar)$/.test(ext)
              ? FileArchive
              : /^(json|js|ts|py|yml|yaml|html|css)$/.test(ext)
                ? FileCode2
                : /^(pdf|epub|txt|md|docx)$/.test(ext)
                  ? FileText
                  : File;
  return (
    <span className={`entry-icon ${entry.kind}`}>
      <Icon size={21} strokeWidth={1.7} />
    </span>
  );
}

function Logo() {
  return (
    <>
      <span className="logo-icon">
        <FolderOpen size={23} strokeWidth={1.8} />
      </span>
      <span>
        partyfinder<span className="logo-dot">.</span>
      </span>
    </>
  );
}

function Login({
  connection,
  onConnect,
}: {
  connection: Connection | null;
  onConnect: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function connect(guest = false) {
    setBusy(true);
    setError('');
    try {
      await api('/api/session', {
        method: 'POST',
        body: JSON.stringify({ password: guest ? '' : password }),
      });
      setPassword('');
      onConnect();
    } catch (error) {
      setError((error as Error).message);
    }
    setBusy(false);
  }
  return (
    <main className="login-page">
      <div className="login-theme">
        <ThemePicker />
      </div>
      <div className="login-brand">
        <Logo />
      </div>
      <div className="login-card">
        <div className="login-art">
          <FolderOpen size={48} strokeWidth={1.2} />
          <span>
            <Search size={24} />
          </span>
        </div>
        <span className="eyebrow">YOUR FILES, A LITTLE CLOSER</span>
        <h1>
          Find your way
          <br />
          to the right file.
        </h1>
        <p>
          A familiar explorer for your Copyparty server.
          <br />
          Open a folder. Search from there.
        </p>
        <div className="connection-pill">
          <Server size={15} />
          <span>{connection?.server || 'Connecting to server…'}</span>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <label htmlFor="password">Copyparty password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <button className="primary login-submit" disabled={busy || !password}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <>
                Connect to server <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <button className="guest-button" onClick={() => void connect(true)} disabled={busy}>
          Browse as guest <ArrowRight size={14} />
        </button>
        <small>
          Use the same password as Copyparty. Guest access follows your server’s permissions.
        </small>
      </div>
      <div className="login-footer">Made for finding. Powered by Copyparty.</div>
    </main>
  );
}

export default function App() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [route, setRoute] = useState(readLocation);
  const [draft, setDraft] = useState(route.q);
  const [response, setResponse] = useState<{
    key: string;
    data?: Listing | SearchResults;
    error?: string;
  } | null>(null);
  const [volumes, setVolumes] = useState<Entry[]>([]);
  const [recent, setRecent] = useState<Place[]>(readRecent);
  const [startupError, setStartupError] = useState('');
  const [reload, setReload] = useState(0);
  const [sort, setSort] = useState<Sort>('name');
  const [descending, setDescending] = useState(false);
  const requestKey = JSON.stringify({ route, reload, signedIn });
  const data = response?.key === requestKey ? response.data : undefined;
  const listing = data && !('scanned' in data) ? data : null;
  const results = data && 'scanned' in data ? data : null;
  const busy = signedIn === true && response?.key !== requestKey;
  const error = response?.key === requestKey ? response.error || '' : '';
  const [filterState, setFilterState] = useState({ key: '', value: 'all' });
  const filter = filterState.key === requestKey ? filterState.value : 'all';
  const setFilter = (value: string) => setFilterState({ key: requestKey, value });
  const [view, setView] = useState<'list' | 'grid'>(readView);
  const [visibleState, setVisibleState] = useState({ key: '', value: 250 });
  const visibleCount = visibleState.key === requestKey ? visibleState.value : 250;
  const setVisibleCount = (value: number) => setVisibleState({ key: requestKey, value });
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const searching = Boolean(route.q);
  const folderName = route.path === '/' ? 'All files' : route.path.split('/').at(-1)!;

  useEffect(() => {
    Promise.all([api<Connection>('/api/config'), api<{ signedIn: boolean }>('/api/session')])
      .then(([config, session]) => {
        setConnection(config);
        setSignedIn(session.signedIn);
      })
      .catch((error) => setStartupError(error.message));
    const pop = () => {
      const next = readLocation();
      setRoute(next);
      setDraft(next.q);
    };
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);

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
            try {
              localStorage.setItem('partyfinder.recent', JSON.stringify(next));
            } catch {
              /* optional */
            }
            return next;
          });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) setSignedIn(false);
        else setResponse({ key: requestKey, error: error.message });
      });
    return () => controller.abort();
  }, [signedIn, route, requestKey, folderName]);

  function navigate(next: Partial<typeof route>) {
    setMenu(null);
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
  function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    if (draft.trim()) {
      navigate({ q: draft, limit: 250 });
      setReload((n) => n + 1);
    } else navigate({ q: '', limit: 250 });
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (menu) return;
      const editing = /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement)?.tagName);
      if (event.key === '/' && !editing) {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === 'Escape' && (draft || route.q)) {
        event.preventDefault();
        navigate({ q: '', limit: 250 });
      }
      if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        openFolder(parentOf(route.path));
      }
    };
    addEventListener('keydown', keydown);
    return () => removeEventListener('keydown', keydown);
  });
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
  async function logout() {
    try {
      await api('/api/session', { method: 'DELETE' });
      setSignedIn(false);
      setVolumes([]);
      setResponse(null);
      setRecent([]);
      try {
        localStorage.removeItem('partyfinder.recent');
      } catch {
        /* optional */
      }
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
  function contextProps(entry: Entry) {
    return {
      onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setMenu({ entry, x: event.clientX, y: event.clientY });
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu({ entry, x: rect.left + 24, y: rect.top + 24 });
        }
      },
    };
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
        <LoaderCircle className="spin" size={26} />
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

  const renderName = (entry: Entry) => (
    <div className="entry-identity">
      <EntryIcon entry={entry} />
      <div>
        {entry.kind === 'directory' ? (
          <button className="entry-name" onClick={() => openFolder(entry.path)} title={entry.name}>
            {entry.name}
          </button>
        ) : (
          <a
            className="entry-name"
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            title={`Open ${entry.name} in Copyparty`}
          >
            {entry.name}
          </a>
        )}
        {searching && (
          <button
            className="entry-parent"
            title={`Open ${entry.parent}`}
            onClick={() => openFolder(entry.parent)}
          >
            {entry.parent}
          </button>
        )}
      </div>
    </div>
  );
  const renderActions = (entry: Entry) => (
    <div className="entry-actions">
      <button
        className="icon-button"
        aria-label={`Actions for ${entry.name}`}
        title="More actions"
        aria-haspopup="menu"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu({ entry, x: rect.right - 260, y: rect.bottom });
        }}
      >
        <MoreHorizontal size={17} />
      </button>
      {entry.kind === 'directory' ? (
        <button
          className="icon-button"
          title={`Open ${entry.name}`}
          aria-label={`Open folder ${entry.name}`}
          onClick={() => openFolder(entry.path)}
        >
          <ChevronRight size={17} />
        </button>
      ) : (
        <>
          <a
            className="icon-button"
            title={`Download ${entry.name}`}
            aria-label={`Download ${entry.name}`}
            href={download(entry)}
          >
            <ArrowDownToLine size={16} />
          </a>
          <a
            className="icon-button"
            title="Open in Copyparty"
            aria-label={`Open ${entry.name} in Copyparty`}
            href={entry.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} />
          </a>
        </>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            openFolder('/');
          }}
        >
          <Logo />
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <Server size={18} />
          </span>
          <div>
            <strong>Your Copyparty</strong>
            <span>
              <i />
              Connected
            </span>
          </div>
        </div>
        <div className="nav-section">
          <span className="nav-label">WORKSPACE</span>
          <button
            className={`nav-item ${route.path === '/' ? 'active' : ''}`}
            onClick={() => openFolder('/')}
          >
            <HardDrive size={18} />
            All files
          </button>
        </div>
        <div className="nav-section volume-nav">
          <span className="nav-label">LOCATIONS</span>
          {volumes.map((volume) => (
            <button
              key={volume.path}
              className={`nav-item ${route.path === volume.path || route.path.startsWith(volume.path + '/') ? 'active' : ''}`}
              onClick={() => openFolder(volume.path)}
            >
              <Folder size={18} />
              <span>{volume.name}</span>
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="nav-section recent-nav">
            <span className="nav-label">RECENT FOLDERS</span>
            {recent.map((place) => (
              <button
                className="nav-item recent-item"
                key={place.path}
                onClick={() => openFolder(place.path)}
                title={place.path}
              >
                <Clock3 size={16} />
                <span>{place.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="server-caption">
            <Server size={14} />
            <span title={connection?.server}>{connection?.server}</span>
          </div>
          <button className="nav-item signout" onClick={() => void logout()}>
            <LogOut size={16} />
            Disconnect
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="navigation-buttons">
            <button
              className="icon-button"
              title="Back"
              aria-label="Back"
              onClick={() => history.back()}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="icon-button"
              title="Forward"
              aria-label="Forward"
              onClick={() => history.forward()}
            >
              <ArrowRight size={17} />
            </button>
            <button
              className="icon-button"
              title="Parent folder · Alt ↑"
              aria-label="Parent folder"
              disabled={route.path === '/'}
              onClick={() => openFolder(parentOf(route.path))}
            >
              <ArrowUp size={17} />
            </button>
            <button
              className="icon-button"
              title="Refresh"
              aria-label="Refresh"
              disabled={busy}
              onClick={() => setReload((n) => n + 1)}
            >
              <RefreshCw size={15} />
            </button>
          </div>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <button onClick={() => openFolder('/')}>
              <HardDrive size={15} />
              <span>All files</span>
            </button>
            {crumbs.map((name, index) => (
              <span className="crumb" key={index}>
                <ChevronRight size={13} />
                <button
                  aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                  title={name}
                  onClick={() => openFolder('/' + crumbs.slice(0, index + 1).join('/'))}
                >
                  {name}
                </button>
              </span>
            ))}
          </nav>
          <a
            className="upstream-link"
            href={
              connection
                ? connection.url +
                  route.path.split('/').filter(Boolean).map(encodeURIComponent).join('/') +
                  (route.path === '/' ? '' : '/')
                : undefined
            }
            target="_blank"
            rel="noreferrer"
            title="Open current folder in Copyparty"
            aria-label="Open current folder in Copyparty"
          >
            Open in Copyparty <ExternalLink size={13} />
          </a>
          <ThemePicker />
          <button
            className="icon-button mobile-disconnect"
            aria-label="Disconnect"
            title="Disconnect"
            onClick={() => void logout()}
          >
            <LogOut size={15} />
          </button>
        </header>

        <main className="main-content">
          <div className="page-title">
            <div>
              <span className="eyebrow">FILE EXPLORER</span>
              <h1>{folderName}</h1>
              <p>
                {route.path === '/'
                  ? 'Everything on your server, right where you left it.'
                  : 'Browse this folder, or find something inside it.'}
              </p>
            </div>
            <span className="folder-emblem">
              <FolderOpen size={33} strokeWidth={1.4} />
            </span>
          </div>
          <section className="search-panel" aria-label="Search files">
            <form className="search-form" onSubmit={submitSearch}>
              <Search size={21} />
              <input
                ref={input}
                aria-label="Search phrase"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Search ${route.path === '/' ? 'your files' : 'in ' + folderName}…`}
                maxLength={300}
              />
              {draft && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => {
                    setDraft('');
                    navigate({ q: '', limit: 250 });
                    input.current?.focus();
                  }}
                >
                  <X size={17} />
                </button>
              )}
              <kbd>/</kbd>
              <button
                className="primary search-submit"
                type="submit"
                disabled={busy || !draft.trim()}
              >
                {busy && searching ? <LoaderCircle size={16} className="spin" /> : 'Search'}
              </button>
            </form>
            <div className="search-options">
              <div className="scope-note">
                <Folder size={14} />
                <span>
                  Search in <strong title={route.path}>{folderName}</strong>
                </span>
              </div>
              <label className="scope-toggle">
                <input
                  type="checkbox"
                  checked={route.recursive}
                  onChange={(e) => navigate({ recursive: e.target.checked, limit: 250 })}
                />
                <span className="custom-check">
                  <Check size={12} strokeWidth={3} />
                </span>
                Include subfolders
              </label>
              <span className="phrase-note">Matches a phrase in the filename</span>
            </div>
          </section>

          <div className="results-toolbar">
            <div className="results-title">
              <h2>{searching ? 'Search results' : 'Folder contents'}</h2>
              {!busy && !error && (
                <span className="count-badge">{allEntries.length.toLocaleString()}</span>
              )}
              {searching && (
                <button className="clear-results" onClick={() => navigate({ q: '', limit: 250 })}>
                  Clear search <X size={13} />
                </button>
              )}
            </div>
            <div className="toolbar-actions">
              <label className="kind-filter">
                <SlidersHorizontal size={14} />
                <select
                  aria-label="Filter by type"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setVisibleCount(250);
                  }}
                >
                  <option value="all">All types</option>
                  <option value="directory">Folders</option>
                  <option value="file">Files</option>
                </select>
              </label>
              <div className="view-toggle" aria-label="Display">
                <button
                  className={view === 'list' ? 'selected' : ''}
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => {
                    setView('list');
                    localStorage.setItem('partyfinder.view', 'list');
                  }}
                >
                  <List size={16} />
                </button>
                <button
                  className={view === 'grid' ? 'selected' : ''}
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => {
                    setView('grid');
                    localStorage.setItem('partyfinder.view', 'grid');
                  }}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          </div>
          {searching && (
            <p className="search-description">
              “{route.q}” in <strong>{route.path}</strong>
              {route.recursive ? ' and subfolders' : ' only'}
              <span> · {route.recursive ? 'Indexed files' : 'Files and folders'}</span>
            </p>
          )}

          <section
            className={`file-panel ${view}`}
            aria-label={searching ? 'Search results' : 'Folder contents'}
            aria-busy={busy}
          >
            {busy ? (
              <div className="empty-state" role="status">
                <LoaderCircle className="spin" size={29} />
                <h3>{searching ? 'Finding your files…' : 'Opening folder…'}</h3>
                <p>
                  {searching
                    ? 'Searching ' +
                      (route.recursive ? 'this folder and its children.' : 'this folder.')
                    : 'Getting the latest contents from Copyparty.'}
                </p>
              </div>
            ) : error ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <Server size={29} />
                </span>
                <h3>Couldn’t load this view</h3>
                <p role="alert">{error}</p>
                <div className="empty-actions">
                  <button className="secondary" onClick={() => setReload((n) => n + 1)}>
                    Try again
                  </button>
                  <button className="secondary" onClick={() => openFolder('/')}>
                    Go to all files
                  </button>
                </div>
              </div>
            ) : entries.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  {searching ? <Search size={30} /> : <FolderOpen size={30} />}
                </span>
                <h3>
                  {searching
                    ? 'No matches here'
                    : filter !== 'all'
                      ? 'No items of this type'
                      : 'A little room to breathe'}
                </h3>
                <p>
                  {searching
                    ? 'Try a shorter phrase' +
                      (!route.recursive
                        ? ', or include subfolders.'
                        : '. Only indexed files appear in recursive search.')
                    : 'This folder has no visible ' +
                      (filter === 'all'
                        ? 'files or folders.'
                        : filter === 'file'
                          ? 'files.'
                          : 'folders.')}
                </p>
                {searching && !route.recursive && (
                  <button className="secondary" onClick={() => navigate({ recursive: true })}>
                    Search subfolders
                  </button>
                )}
              </div>
            ) : view === 'list' ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <button onClick={() => changeSort('name')}>
                          Name{' '}
                          {sort === 'name' && (
                            <ArrowDown size={13} className={descending ? '' : 'sort-up'} />
                          )}
                        </button>
                      </th>
                      <th className="type-column">Type</th>
                      <th className="size-column">
                        <button onClick={() => changeSort('size')}>
                          Size {sort === 'size' && <ArrowDown size={13} />}
                        </button>
                      </th>
                      <th className="date-column">
                        <button onClick={() => changeSort('modified')}>
                          Modified {sort === 'modified' && <ArrowDown size={13} />}
                        </button>
                      </th>
                      <th className="actions-column">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(0, visibleCount).map((entry) => (
                      <tr
                        key={entry.path}
                        {...contextProps(entry)}
                        onDoubleClick={() => {
                          if (entry.kind === 'directory') openFolder(entry.path);
                        }}
                      >
                        <td>{renderName(entry)}</td>
                        <td className="type-column">{fileKind(entry)}</td>
                        <td className="size-column">
                          {entry.kind === 'directory' ? '—' : bytes(entry.size)}
                        </td>
                        <td className="date-column">
                          {entry.modified
                            ? new Date(entry.modified * 1000).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td>{renderActions(entry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="file-grid">
                {entries.slice(0, visibleCount).map((entry) => (
                  <article className="file-card" key={entry.path} {...contextProps(entry)}>
                    {renderName(entry)}
                    <div className="card-meta">
                      <span>{entry.kind === 'directory' ? 'Folder' : bytes(entry.size)}</span>
                      {renderActions(entry)}
                    </div>
                    {entry.kind === 'file' && (
                      <button className="copy-link" onClick={() => void copyUrl(entry.url)}>
                        Copy link
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            {!busy && !error && entries.length > visibleCount && (
              <div className="load-more">
                <button className="secondary" onClick={() => setVisibleCount(visibleCount + 250)}>
                  Show more items
                </button>
              </div>
            )}
          </section>

          {results?.more && !busy && (
            <div className="more-results">
              <span>
                Showing {results.entries.length.toLocaleString()} matches from{' '}
                {results.scanned.toLocaleString()} candidates. More may be available.
              </span>
              <button
                className="secondary"
                onClick={() => navigate({ limit: Math.min(8000, route.limit * 2) })}
              >
                Load more results <ArrowDown size={14} />
              </button>
            </div>
          )}
          {results?.capped && !busy && (
            <div className="limit-notice" role="status">
              The server’s result limit may have been reached. Narrow your phrase or choose a deeper
              folder to find more.
            </div>
          )}
          <footer
            className={`content-footer ${searching && route.recursive ? 'search-footer' : ''}`}
          >
            <span>
              {!busy && !error
                ? searching
                  ? `${entries.length.toLocaleString()} results returned`
                  : `${folders.toLocaleString()} folders · ${files.toLocaleString()} files`
                : 'Connected to Copyparty'}
            </span>
            <span>
              {searching && route.recursive
                ? 'Indexed files · server result limits may apply'
                : 'Your server. Your files.'}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {menu && (
        <EntryMenu
          key={menu.entry.path}
          target={menu}
          onClose={() => setMenu(null)}
          onChanged={(message) => {
            setToast(message);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
