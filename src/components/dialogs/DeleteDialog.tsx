import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Entry } from '../../../shared/types';

/**
 * Compare typed confirmation to the real name. Unicode-normalised, because a
 * macOS keyboard can produce NFD for a name Copyparty stored as NFC; the value
 * actually submitted is `entry.name`, never the typed string.
 */
function matchesName(typed: string, name: string): boolean {
  return typed.normalize('NFC') === name.normalize('NFC');
}

export function DeleteDialog({
  entry,
  onCancel,
  onDone,
}: {
  entry: Entry;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const isFolder = entry.kind === 'directory';
  const [confirmation, setConfirmation] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hintId = useId();
  const errorId = useId();

  const confirmed = !isFolder || matchesName(confirmation, entry.name);
  const invalid = attempted && !confirmed;

  useEffect(() => {
    dialog.current?.showModal();
    // Explicit initial focus: the confirmation field when there is one, and
    // otherwise Cancel — never the destructive button.
    if (isFolder) field.current?.focus();
    else cancel.current?.focus();
  }, [isFolder]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('/api/delete', {
        method: 'POST',
        body: JSON.stringify({ path: entry.path, confirmation: entry.name }),
      });
      onDone(`Deleted ${entry.name}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setAttempted(true);
    if (!confirmed) {
      field.current?.focus();
      return;
    }
    void submit();
  }

  const hint = busy
    ? 'Deleting…'
    : !isFolder
      ? ''
      : confirmed
        ? 'The name matches. Delete is available.'
        : `Type the folder name exactly — ${entry.name} — to enable Delete.`;

  return (
    <dialog
      ref={dialog}
      className="mutation-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form onSubmit={onSubmit}>
        <h2 id={titleId}>Delete {isFolder ? 'folder' : 'file'}?</h2>
        <p id={descriptionId}>
          Permanently delete <strong>{entry.name}</strong>
          {isFolder
            ? ' and all its contents, including hidden files and any nested mounted volumes'
            : ''}{' '}
          from Copyparty? This cannot be undone in Partyfinder.
        </p>
        {isFolder && (
          <label className="dialog-field" htmlFor={`${titleId}-confirm`}>
            Type the folder name to confirm
            <input
              id={`${titleId}-confirm`}
              ref={field}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              readOnly={busy}
              aria-invalid={invalid || undefined}
              aria-describedby={`${hintId}${invalid ? ` ${errorId}` : ''}`}
            />
          </label>
        )}
        {invalid && (
          <p className="field-error" id={errorId}>
            The name does not match yet.
          </p>
        )}
        <p className="dialog-hint" id={hintId} aria-live="polite">
          {hint}
        </p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            ref={cancel}
            className="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary danger-button"
            aria-disabled={busy || !confirmed || undefined}
            aria-describedby={hintId}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
