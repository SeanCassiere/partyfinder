import type { FormEvent, RefObject } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { ResultsToolbar } from './ResultsToolbar';
import { SearchForm } from './SearchForm';
import { ThemePicker } from './ThemePicker';
import { parentOf } from '../lib/format';
import type { Connection, Route, Sort, View } from '../lib/types';

export function Toolbar({
  route,
  crumbs,
  connection,
  busy,
  folderName,
  draft,
  setDraft,
  searching,
  inputRef,
  onSubmit,
  navigate,
  filter,
  setFilter,
  setVisibleCount,
  view,
  setView,
  sort,
  descending,
  changeSort,
  openFolder,
  onRefresh,
  onDisconnect,
}: {
  route: Route;
  crumbs: string[];
  connection: Connection | null;
  busy: boolean;
  folderName: string;
  draft: string;
  setDraft: (value: string) => void;
  searching: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event?: FormEvent) => void;
  navigate: (next: Partial<Route>) => void;
  filter: string;
  setFilter: (value: string) => void;
  setVisibleCount: (value: number) => void;
  view: View;
  setView: (view: View) => void;
  sort: Sort;
  descending: boolean;
  changeSort: (value: Sort) => void;
  openFolder: (path: string) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  const upstream = connection
    ? connection.url +
      route.path.split('/').filter(Boolean).map(encodeURIComponent).join('/') +
      (route.path === '/' ? '' : '/')
    : undefined;
  return (
    <header className="topbar">
      <div className="toolbar-group navigation-buttons">
        <button
          className="icon-button"
          title="Back"
          aria-label="Back"
          onClick={() => history.back()}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          title="Forward"
          aria-label="Forward"
          onClick={() => history.forward()}
        >
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          title="Parent folder (Alt + Up arrow)"
          aria-label="Parent folder, Alt and up arrow"
          disabled={route.path === '/'}
          onClick={() => openFolder(parentOf(route.path))}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          title="Refresh"
          aria-label="Refresh"
          disabled={busy}
          onClick={onRefresh}
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      <Breadcrumbs crumbs={crumbs} openFolder={openFolder} />

      <SearchForm
        route={route}
        folderName={folderName}
        draft={draft}
        setDraft={setDraft}
        busy={busy}
        searching={searching}
        inputRef={inputRef}
        onSubmit={onSubmit}
        navigate={navigate}
      />

      <ResultsToolbar
        filter={filter}
        setFilter={setFilter}
        setVisibleCount={setVisibleCount}
        view={view}
        setView={setView}
        sort={sort}
        descending={descending}
        changeSort={changeSort}
      />

      <div className="toolbar-group toolbar-end">
        <ThemePicker />
        <a
          className="icon-button upstream-link"
          href={upstream}
          target="_blank"
          rel="noreferrer"
          title="Open current folder in Copyparty"
          aria-label="Open current folder in Copyparty"
        >
          <ExternalLink size={15} aria-hidden="true" />
        </a>
        <button
          className="icon-button"
          aria-label="Disconnect"
          title="Disconnect"
          onClick={onDisconnect}
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
