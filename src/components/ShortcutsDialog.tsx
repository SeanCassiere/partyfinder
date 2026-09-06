import { useEffect, useId, useRef } from 'react';

/**
 * The keyboard model, written down. Opened with `?` or from the sidebar footer.
 *
 * A native `<dialog>` opened with `showModal()` gives the focus trap, the inert
 * background and Escape-to-close for free — the app's global key handler skips
 * anything inside an open dialog, so nothing here needs to stop propagation.
 */
const GROUPS: { title: string; rows: { keys: string[]; description: string }[] }[] = [
  {
    title: 'Anywhere',
    rows: [
      { keys: ['/'], description: 'Focus the search box' },
      { keys: ['Esc'], description: 'Clear the search, or close a menu or dialog' },
      { keys: ['Alt', '↑'], description: 'Open the parent folder' },
      { keys: ['?'], description: 'Open this list' },
    ],
  },
  {
    title: 'In the file listing',
    rows: [
      { keys: ['↑'], description: 'Move up one row' },
      { keys: ['↓'], description: 'Move down one row' },
      {
        keys: ['←', '→'],
        description: 'List: step through the row’s controls. Grid: move columns',
      },
      { keys: ['Enter'], description: 'Open the folder, or open the file in Copyparty' },
      { keys: ['Space'], description: 'Select or deselect the row' },
      { keys: ['Home', 'End'], description: 'First or last row' },
      { keys: ['PageUp', 'PageDown'], description: 'Move ten rows' },
      { keys: ['Shift', 'F10'], description: 'Open the entry menu (or the menu key)' },
      { keys: ['A–Z'], description: 'Type-ahead: jump to the next name that starts with it' },
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialog.current?.showModal();
    close.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="mutation-dialog shortcuts-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId}>Keyboard shortcuts</h2>
      {GROUPS.map((group) => (
        <section key={group.title} className="shortcut-group">
          <p className="shortcut-group-title">{group.title}</p>
          <dl className="shortcut-list">
            {group.rows.map((row) => (
              <div className="shortcut-row" key={row.description}>
                <dt>
                  {row.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{row.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <div className="dialog-actions">
        <button type="button" ref={close} className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
