import { ArrowDownToLine, ChevronRight, ExternalLink, Link2, MoreHorizontal } from 'lucide-react';
import { EntryIcon } from './EntryIcon';
import type { EntryContextProps } from '../hooks/useEntryMenu';
import type { Entry } from '../../shared/types';

/** Everything a rendered entry needs, threaded as one object rather than six props. */
export type EntryActions = {
  searching: boolean;
  openFolder: (path: string) => void;
  /** Open the entry menu anchored to a control; the menu measures itself (useEntryMenu). */
  openMenuAt: (entry: Entry, anchor: HTMLElement) => void;
  download: (entry: Entry) => string;
  copyUrl: (url: string) => void;
  contextProps: (entry: Entry) => EntryContextProps;
  /** Path of the entry whose menu is currently open, for `aria-expanded` on the "…" button. */
  menuPath?: string | null;
};

/**
 * Open an entry the way its name link does: folders navigate in place, files open in Copyparty.
 * Shared by the name link, double click, and Enter on the focused row.
 */
export function activateEntry(entry: Entry, actions: EntryActions) {
  if (entry.kind === 'directory') actions.openFolder(entry.path);
  else window.open(entry.url, '_blank', 'noopener,noreferrer');
}

export function EntryName({ entry, actions }: { entry: Entry; actions: EntryActions }) {
  return (
    <div className="entry-identity">
      <EntryIcon entry={entry} />
      <div>
        {entry.kind === 'directory' ? (
          <button
            className="entry-name"
            tabIndex={-1}
            onClick={() => actions.openFolder(entry.path)}
            title={entry.name}
          >
            {entry.name}
          </button>
        ) : (
          <a
            className="entry-name"
            tabIndex={-1}
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            title={`Open ${entry.name} in Copyparty`}
          >
            {entry.name}
          </a>
        )}
        {actions.searching && (
          <button
            className="entry-parent"
            tabIndex={-1}
            title={`Open ${entry.parent}`}
            onClick={() => actions.openFolder(entry.parent)}
          >
            {entry.parent}
          </button>
        )}
      </div>
    </div>
  );
}

export function EntryRowActions({
  entry,
  actions,
  /** Include "Copy link" as an icon button (the grid; the list offers it from the menu). */
  copyLink = false,
}: {
  entry: Entry;
  actions: EntryActions;
  copyLink?: boolean;
}) {
  return (
    <div className="entry-actions">
      <button
        className="icon-button"
        tabIndex={-1}
        aria-label={`Actions for ${entry.name}`}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={actions.menuPath === entry.path}
        onClick={(event) => actions.openMenuAt(entry, event.currentTarget)}
      >
        <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {entry.kind === 'directory' ? (
        <button
          className="icon-button"
          tabIndex={-1}
          title={`Open ${entry.name}`}
          aria-label={`Open folder ${entry.name}`}
          onClick={() => actions.openFolder(entry.path)}
        >
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : (
        <>
          {copyLink && (
            <button
              className="icon-button"
              tabIndex={-1}
              title="Copy link"
              aria-label={`Copy link to ${entry.name}`}
              onClick={() => void actions.copyUrl(entry.url)}
            >
              <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <a
            className="icon-button"
            tabIndex={-1}
            title={`Download ${entry.name}`}
            aria-label={`Download ${entry.name}`}
            href={actions.download(entry)}
          >
            <ArrowDownToLine size={16} strokeWidth={1.75} aria-hidden="true" />
          </a>
          <a
            className="icon-button open-external"
            tabIndex={-1}
            title="Open in Copyparty"
            aria-label={`Open ${entry.name} in Copyparty`}
            href={entry.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
          </a>
        </>
      )}
    </div>
  );
}
