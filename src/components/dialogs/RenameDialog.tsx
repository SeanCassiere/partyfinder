import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { Entry } from '../../../shared/types';

/**
 * Where the name stops and the extension begins, in UTF-16 code units so the
 * value can be handed straight to `setSelectionRange`. A leading dot is part of
 * the name, not an extension.
 */
function stemLength(name: string): number {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? dot : name.length;
}

export function RenameDialog({
  entry,
  onCancel,
  onDone,
}: {
  entry: Entry;
  onCancel: () => void;
  /** `path` is the entry's new path, used for focus return. */
  onDone: (message: string, path: string) => void;
}) {
  const [name, setName] = useState(entry.name);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hintId = useId();
  const errorId = useId();

  const trimmed = name.trim();
  const problem =
    trimmed === ''
      ? 'Enter a name.'
      : trimmed === entry.name
        ? 'Enter a name different from the current one.'
        : /[/\\]/.test(trimmed)
          ? 'A name cannot contain a slash.'
          : trimmed === '.' || trimmed === '..'
            ? 'Choose a name other than “.” or “..”.'
            : '';
  const invalid = attempted && problem !== '';

  useEffect(() => {
    dialog.current?.showModal();
    const input = field.current;
    if (!input) return;
    input.focus();
    // Select the stem so typing replaces the name but keeps the extension.
    input.setSelectionRange(0, entry.kind === 'file' ? stemLength(entry.name) : entry.name.length);
  }, [entry.name, entry.kind]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('/api/rename', {
        method: 'POST',
        body: JSON.stringify({ path: entry.path, name: trimmed }),
      });
      const base = entry.path.slice(0, entry.path.length - entry.name.length);
      onDone(`Renamed to ${trimmed}`, base + trimmed);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      field.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setAttempted(true);
    if (problem) {
      field.current?.focus();
      return;
    }
    void submit();
  }

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
        <h2 id={titleId}>Rename {entry.kind === 'directory' ? 'folder' : 'file'}</h2>
        <p id={descriptionId}>
          Choose a new name for <strong>{entry.name}</strong>. Its location stays the same.
        </p>
        <label className="dialog-field" htmlFor={`${titleId}-name`}>
          New name
          <input
            id={`${titleId}-name`}
            ref={field}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            autoComplete="off"
            spellCheck={false}
            readOnly={busy}
            aria-invalid={invalid || undefined}
            aria-describedby={`${hintId}${invalid ? ` ${errorId}` : ''}`}
          />
        </label>
        {invalid && (
          <p className="field-error" id={errorId}>
            {problem}
          </p>
        )}
        <p className="dialog-hint" id={hintId}>
          {busy ? 'Renaming…' : problem || 'Press Rename to apply the new name.'}
        </p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            aria-disabled={busy || problem !== '' || undefined}
            aria-describedby={hintId}
          >
            {busy ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
