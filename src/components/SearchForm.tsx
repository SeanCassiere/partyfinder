import type { FormEvent, RefObject } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';
import type { Route } from '../lib/types';

export function SearchForm({
  route,
  folderName,
  draft,
  setDraft,
  busy,
  searching,
  inputRef,
  onSubmit,
  navigate,
}: {
  route: Route;
  folderName: string;
  draft: string;
  setDraft: (value: string) => void;
  busy: boolean;
  searching: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event?: FormEvent) => void;
  navigate: (next: Partial<Route>) => void;
}) {
  const where = route.path === '/' ? 'all files' : folderName;
  // An empty query has nothing to submit: the button drops to a neutral icon button and is
  // announced as disabled, but stays focusable so the reason can be read.
  const empty = !draft.trim();
  const inert = empty || busy;
  return (
    <form className="search-form" role="search" aria-label="Search files" onSubmit={onSubmit}>
      <div className="search-field">
        <Search size={15} aria-hidden="true" />
        <input
          id="search-input"
          ref={inputRef}
          aria-label={`Search ${where}`}
          aria-describedby="search-hint"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Search ${where}…`}
          maxLength={300}
        />
        {draft ? (
          <button
            type="button"
            className="clear-search"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => {
              setDraft('');
              navigate({ q: '', limit: 250 });
              inputRef.current?.focus();
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : (
          <kbd aria-hidden="true">/</kbd>
        )}
      </div>
      <p id="search-hint" className="sr-only">
        Press the slash key to focus search. Matches a phrase in the file name.
      </p>
      <button
        className={empty ? 'search-submit' : 'search-submit primary'}
        type="submit"
        aria-label="Search"
        title="Search"
        aria-disabled={inert}
        aria-describedby={empty ? 'search-submit-hint' : undefined}
        onClick={(event) => {
          if (inert) event.preventDefault();
        }}
      >
        {busy && searching ? (
          <LoaderCircle size={15} className="spin" aria-hidden="true" />
        ) : (
          <Search size={15} aria-hidden="true" />
        )}
      </button>
      <p id="search-submit-hint" className="sr-only">
        Type something to search
      </p>
      <label className="scope-toggle">
        <input
          type="checkbox"
          checked={route.recursive}
          onChange={(e) => navigate({ recursive: e.target.checked, limit: 250 })}
        />
        <span>Subfolders</span>
      </label>
    </form>
  );
}
