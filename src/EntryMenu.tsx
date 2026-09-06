import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { api } from './api';
import type { Entry } from '../shared/types';

export type MenuTarget = { entry: Entry; x: number; y: number };
export function EntryMenu({
  target,
  onClose,
  onChanged,
}: {
  target: MenuTarget;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const { entry } = target;
  const [permissions, setPermissions] = useState<{
    rename: boolean;
    delete: boolean;
    reason: string;
  } | null>(null);
  const [action, setAction] = useState<'rename' | 'delete' | null>(null);
  const [name, setName] = useState(entry.name);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controller = new AbortController();
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    api<{ rename: boolean; delete: boolean; reason: string }>(
      `/api/actions?path=${encodeURIComponent(entry.path)}`,
      { signal: controller.signal },
    )
      .then(setPermissions)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      previous?.focus();
    };
  }, [entry.path]);
  useEffect(() => {
    if (!action) return;
    dialog.current?.showModal();
    if (action === 'rename') nameInput.current?.select();
  }, [action]);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          path: entry.path,
          ...(action === 'rename'
            ? { name }
            : { confirmation: entry.kind === 'directory' ? confirmation : entry.name }),
        }),
      });
      onChanged(action === 'rename' ? `Renamed to ${name}` : `Deleted ${entry.name}`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }
  return (
    <>
      {!action && (
        <div
          className="menu-backdrop"
          onPointerDown={onClose}
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <div
            ref={menu}
            className="entry-menu"
            role="menu"
            aria-label={`Actions for ${entry.name}`}
            style={{
              left: Math.max(8, Math.min(target.x, innerWidth - 272)),
              top: Math.max(8, Math.min(target.y, innerHeight - 270)),
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape' || e.key === 'Tab') {
                onClose();
                return;
              }
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                const items = Array.from(
                  menu.current!.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'),
                );
                const index = items.indexOf(document.activeElement as HTMLElement);
                items[
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? items.length - 1
                      : (index + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
                ]?.focus();
              }
            }}
          >
            <div className="menu-filename" title={entry.name}>
              {entry.name}
            </div>
            <a role="menuitem" href={entry.url} target="_blank" rel="noreferrer" onClick={onClose}>
              <ExternalLink size={16} />
              Open in Copyparty
            </a>
            <button
              role="menuitem"
              disabled={!permissions?.rename}
              onClick={() => {
                setError('');
                setAction('rename');
              }}
            >
              <Pencil size={16} />
              Rename
            </button>
            <button
              role="menuitem"
              className="danger-text"
              disabled={!permissions?.delete}
              onClick={() => {
                setError('');
                setAction('delete');
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
            <p className="menu-hint" role="status">
              {error || (!permissions ? 'Checking permissions…' : permissions.reason)}
            </p>
          </div>
        </div>
      )}
      {action && (
        <dialog
          ref={dialog}
          className="mutation-dialog"
          aria-labelledby="mutation-title"
          aria-describedby="mutation-description"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) onClose();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h2 id="mutation-title">
              {action === 'rename' ? 'Rename' : 'Delete'}{' '}
              {entry.kind === 'directory' ? 'folder' : 'file'}?
            </h2>
            <p id="mutation-description">
              {action === 'delete' ? (
                <>
                  Permanently delete <strong>{entry.name}</strong>
                  {entry.kind === 'directory'
                    ? ' and all its contents, including hidden files and any nested mounted volumes'
                    : ''}{' '}
                  from Copyparty? This cannot be undone in Partyfinder.
                </>
              ) : (
                <>
                  Choose a new name for <strong>{entry.name}</strong>. Its location stays the same.
                </>
              )}
            </p>
            {action === 'rename' && (
              <label>
                New name
                <input
                  ref={nameInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={255}
                  disabled={busy}
                />
              </label>
            )}
            {action === 'delete' && entry.kind === 'directory' && (
              <label>
                Type the folder name to confirm
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
            )}
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                autoFocus={action === 'delete'}
                className="secondary"
                disabled={busy}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={action === 'delete' ? 'primary danger-button' : 'primary'}
                disabled={
                  busy ||
                  (action === 'rename' && (!name.trim() || name === entry.name)) ||
                  (action === 'delete' && entry.kind === 'directory' && confirmation !== entry.name)
                }
              >
                {busy ? 'Working…' : action === 'rename' ? 'Rename' : 'Delete'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
