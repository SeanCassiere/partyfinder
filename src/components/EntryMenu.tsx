import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { DeleteDialog } from './dialogs/DeleteDialog';
import { RenameDialog } from './dialogs/RenameDialog';
import { api } from '../lib/api';
import type { Entry } from '../../shared/types';

/**
 * Where the menu should appear.
 *
 * `x`/`y` are viewport coordinates of the anchor point: the pointer position
 * for a right-click, or an edge of the anchoring control for a click on the
 * "…" button. `align: 'end'` right-aligns the popup with `x` (use it with
 * `rect.right`); the default left-aligns it. The menu measures itself and
 * flips or clamps to stay in the viewport, so callers never need to know how
 * wide or tall it is.
 */
export type MenuTarget = {
  entry: Entry;
  x: number;
  y: number;
  align?: 'start' | 'end';
};

type Permissions = { rename: boolean; delete: boolean; reason: string };

type MenuItem = {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  separated?: boolean;
  onSelect?: () => void;
};

const EDGE = 8;
const TYPEAHEAD_MS = 500;

/** Focus the row for `path`, if the listing exposes one. See `onCloseFocus`. */
function focusEntry(path: string): boolean {
  for (const node of document.querySelectorAll<HTMLElement>('[data-entry-path]')) {
    if (node.dataset.entryPath === path) {
      node.focus();
      return document.activeElement === node;
    }
  }
  return false;
}

export function EntryMenu({
  target,
  onClose,
  onChanged,
  onCloseFocus,
}: {
  target: MenuTarget;
  onClose: () => void;
  onChanged: (message: string) => void;
  /**
   * Focus-return contract. When the menu (or the dialog it opened) closes,
   * focus is restored in this order:
   *
   *   1. `onCloseFocus(path)` — return `true` to say you handled it. `path` is
   *      the entry's path, or its *new* path after a successful rename.
   *   2. the element carrying `data-entry-path="<path>"`. Listing rows should
   *      render that attribute (WP3) so focus lands back on the row rather
   *      than on a detached node after a refresh.
   *   3. the element that had focus when the menu opened, if still connected.
   *   4. `<main tabindex="-1">`, so focus never falls to `<body>`.
   *
   * A deleted entry has no row, so it falls through to step 3 or 4.
   */
  onCloseFocus?: (path: string) => boolean | void;
}) {
  const { entry } = target;
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [action, setAction] = useState<'rename' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ left: target.x, top: target.y, placed: false });
  const [viewport, setViewport] = useState(0);
  const popup = useRef<HTMLDivElement>(null);
  const itemNodes = useRef<(HTMLElement | null)[]>([]);
  const typeahead = useRef({ text: '', at: 0 });
  const opener = useRef<HTMLElement | null>(null);
  const focusPath = useRef(entry.path);
  const closeFocus = useRef(onCloseFocus);
  const hintId = useId();

  useEffect(() => {
    closeFocus.current = onCloseFocus;
  }, [onCloseFocus]);

  // Permissions, plus the focus-return that runs when the whole menu unmounts.
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const controller = new AbortController();
    api<Permissions>(`/api/actions?path=${encodeURIComponent(entry.path)}`, {
      signal: controller.signal,
    })
      .then(setPermissions)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      const path = focusPath.current;
      if (closeFocus.current?.(path) === true) return;
      if (!focusEntry(path)) {
        const previous = opener.current;
        // Last resort — a deleted entry's row is gone, and on macOS a click
        // never focused the opener in the first place.
        const fallback =
          previous && previous !== document.body && previous.isConnected
            ? previous
            : document.querySelector<HTMLElement>('main[tabindex]');
        fallback?.focus();
        // The listing may still be re-rendering after a rename or delete;
        // upgrade to the row itself once it exists.
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (active === document.body || active === fallback) focusEntry(path);
        });
      }
    };
  }, [entry.path]);

  // Self-measuring placement: flip and clamp so the menu always fits.
  useLayoutEffect(() => {
    const node = popup.current;
    if (!node) return;
    const { offsetWidth: width, offsetHeight: height } = node;
    const start = target.align === 'end' ? target.x - width : target.x;
    const flipped = start + width > innerWidth - EDGE ? target.x - width : start;
    const left = Math.max(EDGE, Math.min(flipped, innerWidth - width - EDGE));
    const above = target.y + height > innerHeight - EDGE ? target.y - height : target.y;
    const top = Math.max(EDGE, Math.min(above, innerHeight - height - EDGE));
    setPosition((current) =>
      current.placed && current.left === left && current.top === top
        ? current
        : { left, top, placed: true },
    );
  }, [target.x, target.y, target.align, permissions, error, action, viewport]);

  useEffect(() => {
    const remeasure = () => setViewport((tick) => tick + 1);
    addEventListener('resize', remeasure);
    return () => removeEventListener('resize', remeasure);
  }, []);

  // Roving focus: exactly one item is reachable, and it is focused on open.
  useEffect(() => {
    if (action) return;
    itemNodes.current[activeIndex]?.focus();
  }, [activeIndex, action]);

  // A right-click focuses the row underneath it, and the browser may do that
  // after the menu has mounted. Re-assert on the next frame, and hold focus
  // inside the open menu (Tab and click-outside close it deliberately).
  useEffect(() => {
    if (action) return;
    const reclaim = () => {
      const node = popup.current;
      if (node && !node.contains(document.activeElement)) itemNodes.current[activeIndex]?.focus();
    };
    const frame = requestAnimationFrame(reclaim);
    document.addEventListener('focusin', reclaim);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', reclaim);
    };
  }, [action, activeIndex]);

  const items: MenuItem[] = [
    {
      id: 'open',
      label: 'Open in Copyparty',
      icon: <ExternalLink size={16} aria-hidden />,
      href: entry.url,
    },
    {
      id: 'rename',
      label: 'Rename…',
      icon: <Pencil size={16} aria-hidden />,
      disabled: !permissions?.rename,
      separated: true,
      onSelect: () => setAction('rename'),
    },
    {
      id: 'delete',
      label: 'Delete…',
      icon: <Trash2 size={16} aria-hidden />,
      danger: true,
      disabled: !permissions?.delete,
      onSelect: () => setAction('delete'),
    },
  ];
  const hint = error || (permissions ? permissions.reason : 'Checking permissions…');

  function move(next: number) {
    setActiveIndex((next + items.length) % items.length);
  }
  function matchTypeahead(key: string) {
    const now = Date.now();
    const previous = now - typeahead.current.at > TYPEAHEAD_MS ? '' : typeahead.current.text;
    const buffer = previous + key.toLocaleLowerCase();
    typeahead.current = { text: buffer, at: now };
    const labels = items.map((item) => item.label.toLocaleLowerCase());
    const from = buffer.length > 1 ? activeIndex : activeIndex + 1;
    for (let step = 0; step < items.length; step += 1) {
      const index = (from + step) % items.length;
      if (labels[index]!.startsWith(buffer)) {
        setActiveIndex(index);
        return;
      }
    }
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      // Do not let focus escape into the page as the menu unmounts.
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(activeIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(activeIndex - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      move(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      move(items.length - 1);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === ' ') {
        // Space activates, and only <button> does that natively.
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.click();
        return;
      }
      event.preventDefault();
      matchTypeahead(event.key);
    }
  }

  function select(item: MenuItem, event: ReactMouseEvent) {
    if (item.disabled) {
      event.preventDefault();
      return;
    }
    setError('');
    if (item.onSelect) item.onSelect();
    else onClose();
  }

  function finish(message: string, path: string) {
    focusPath.current = path;
    onChanged(message);
    onClose();
  }

  if (action === 'rename')
    return (
      <RenameDialog
        entry={entry}
        onCancel={onClose}
        onDone={(message, path) => finish(message, path)}
      />
    );
  if (action === 'delete')
    return (
      <DeleteDialog entry={entry} onCancel={onClose} onDone={(message) => finish(message, '')} />
    );

  return (
    <div
      className="menu-backdrop"
      onPointerDown={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={popup}
        className="entry-menu"
        style={{
          left: position.left,
          top: position.top,
          // Invisible for the one frame it takes to measure — but still
          // focusable, unlike `visibility: hidden`.
          opacity: position.placed ? undefined : 0,
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <p className="menu-filename" title={entry.name}>
          {entry.name}
        </p>
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label={`Actions for ${entry.name}`}
          onKeyDown={onKeyDown}
        >
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {item.separated && <div role="separator" className="menu-separator" />}
              {item.href ? (
                <a
                  role="menuitem"
                  tabIndex={index === activeIndex ? 0 : -1}
                  className={`menu-item${item.danger ? ' danger-text' : ''}`}
                  aria-disabled={item.disabled || undefined}
                  aria-describedby={item.disabled ? hintId : undefined}
                  ref={(node) => {
                    itemNodes.current[index] = node;
                  }}
                  onFocus={() => setActiveIndex(index)}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => select(item, event)}
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  role="menuitem"
                  type="button"
                  tabIndex={index === activeIndex ? 0 : -1}
                  className={`menu-item${item.danger ? ' danger-text' : ''}`}
                  aria-disabled={item.disabled || undefined}
                  aria-describedby={item.disabled ? hintId : undefined}
                  ref={(node) => {
                    itemNodes.current[index] = node;
                  }}
                  onFocus={() => setActiveIndex(index)}
                  onClick={(event) => select(item, event)}
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </Fragment>
          ))}
        </div>
        <p className="menu-hint" id={hintId}>
          {hint}
        </p>
      </div>
    </div>
  );
}
