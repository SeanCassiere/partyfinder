import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * The keyboard model for the file listing (WAI-ARIA APG "Grid" pattern).
 *
 * The whole listing is a single tab stop: exactly one item carries `tabIndex=0` and the arrow keys
 * move it. The hook is deliberately DOM-agnostic — the column count is passed in as a number, so
 * `FileGrid` can measure its own layout in a ResizeObserver effect while `FileList` passes 1 — and
 * the index math plus the type-ahead matching are exported as pure functions for tests/roving.test.ts.
 */

/** Rows moved by PageUp / PageDown. */
export const PAGE_STEP = 10;

/** How long a type-ahead buffer stays alive after the last keystroke. */
export const TYPE_AHEAD_MS = 600;

/**
 * Base-sensitivity collation: `o` matches `Ö`, and comparison happens per code point rather than
 * per code unit, so astral characters (emoji, CJK extensions) in Copyparty filenames are safe.
 * Never use charCodeAt here.
 */
const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** True when `name` begins with `prefix`, ignoring case and accents. */
export function startsWithBase(name: string, prefix: string): boolean {
  const wanted = Array.from(prefix);
  if (wanted.length === 0) return false;
  const chars = Array.from(name);
  if (wanted.length > chars.length) return false;
  return collator.compare(chars.slice(0, wanted.length).join(''), prefix) === 0;
}

/**
 * Where the roving index lands for a navigation key, or `null` when the key is not ours.
 * `columns` is 1 for the list view, which leaves ArrowLeft/ArrowRight free for the controls
 * inside the active row.
 */
export function moveIndex(
  key: string,
  options: { index: number; count: number; columns?: number; ctrlKey?: boolean },
): number | null {
  const { index, count } = options;
  const columns = Math.max(1, options.columns ?? 1);
  const ctrlKey = options.ctrlKey ?? false;
  if (count <= 0) return null;
  const last = count - 1;
  const clamp = (value: number) => Math.min(last, Math.max(0, value));
  const current = clamp(index);
  if (ctrlKey && key !== 'Home' && key !== 'End') return null;
  switch (key) {
    case 'ArrowDown':
      return clamp(current + columns);
    case 'ArrowUp':
      return clamp(current - columns);
    case 'ArrowRight':
      return columns > 1 ? clamp(current + 1) : null;
    case 'ArrowLeft':
      return columns > 1 ? clamp(current - 1) : null;
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageDown':
      return clamp(current + PAGE_STEP);
    case 'PageUp':
      return clamp(current - PAGE_STEP);
    default:
      return null;
  }
}

/**
 * The index the type-ahead buffer points at, or `null` when nothing matches.
 * A buffer of one character (or the same character repeated, as APG prescribes) cycles through the
 * entries starting with it; a longer buffer matches the whole prefix from the current position.
 */
export function findTypeAheadMatch(
  names: readonly string[],
  buffer: string,
  from: number,
): number | null {
  if (!buffer || names.length === 0) return null;
  const characters = Array.from(buffer);
  const first = characters[0]!;
  const repeated = characters.every((character) => collator.compare(character, first) === 0);
  const needle = repeated ? first : buffer;
  const cycling = characters.length === 1 || repeated;
  const origin = cycling ? from + 1 : from;
  for (let step = 0; step < names.length; step += 1) {
    const index = (((origin + step) % names.length) + names.length) % names.length;
    if (startsWithBase(names[index]!, needle)) return index;
  }
  return null;
}

/** Focusable controls rendered inside a row or card; they all carry `tabIndex={-1}`. */
function controlsIn(item: HTMLElement): HTMLElement[] {
  return Array.from(
    item.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select'),
  );
}

export type RovingItemProps = {
  ref: (element: HTMLElement | null) => void;
  tabIndex: number;
  'aria-selected': boolean;
  onFocus: () => void;
  onMouseDown: () => void;
};

export function useRovingFocus({
  count,
  columns = 1,
  names,
  resetKey = '',
  onActivate,
}: {
  /** Number of navigable items currently rendered. */
  count: number;
  /** 1 for a one-dimensional list; the measured column count for the card grid. */
  columns?: number;
  /** Item names, in render order, for type-ahead. */
  names: readonly string[];
  /** Changing this (folder, query, sort) puts the roving index back at the top. */
  resetKey?: string;
  /** Enter, or a double click, on the item at `index`. */
  onActivate?: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [typeSequence, setTypeSequence] = useState(0);
  const items = useRef(new Map<number, HTMLElement>());
  const container = useRef<HTMLElement | null>(null);
  const buffer = useRef('');
  const previous = useRef({ count, resetKey });

  // The type-ahead buffer is a ref (it must not re-render on every keystroke) but it is only ever
  // cleared from an effect, never during render.
  useEffect(() => {
    if (typeSequence === 0) return;
    const timer = setTimeout(() => {
      buffer.current = '';
    }, TYPE_AHEAD_MS);
    return () => clearTimeout(timer);
  }, [typeSequence]);

  // Keep the roving index meaningful as the listing changes underneath it.
  useEffect(() => {
    const before = previous.current;
    previous.current = { count, resetKey };
    if (before.resetKey !== resetKey) {
      setActiveIndex(0);
      setSelectedIndex(null);
      return;
    }
    if (count > before.count && before.count > 0) {
      // "Show more items" appended rows: park the tab stop on the first new one, and take focus
      // only if the listing (or nothing at all) had it.
      const target = before.count;
      setActiveIndex(target);
      const active = document.activeElement;
      const inListing = active === document.body || (container.current?.contains(active) ?? false);
      if (!active || inListing) {
        const element = items.current.get(target);
        element?.focus({ preventScroll: true });
        element?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (count === 0) {
      if (activeIndex !== 0) setActiveIndex(0);
      if (selectedIndex !== null) setSelectedIndex(null);
      return;
    }
    if (activeIndex > count - 1) setActiveIndex(count - 1);
    if (selectedIndex !== null && selectedIndex > count - 1) setSelectedIndex(null);
  }, [count, resetKey, activeIndex, selectedIndex]);

  function focusIndex(index: number, select = true) {
    setActiveIndex(index);
    if (select) setSelectedIndex(index);
    const element = items.current.get(index);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: 'nearest' });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    // The entry menu's own Shift+F10 / ContextMenu handler runs on the row first and calls
    // preventDefault; never double-handle it here.
    if (event.defaultPrevented || event.nativeEvent.isComposing || count === 0) return;
    const key = event.key;
    const ctrlKey = event.ctrlKey || event.metaKey;
    const item = items.current.get(activeIndex) ?? null;
    const target = event.target as HTMLElement | null;
    const inside = Boolean(item && target && target !== item && item.contains(target));
    const controls = item ? controlsIn(item) : [];
    const controlIndex = inside && target ? controls.indexOf(target) : -1;

    if (key === 'Tab' && !ctrlKey && item) {
      // Tab reaches the row's own controls, then leaves the listing normally.
      if (!inside && !event.shiftKey && controls.length > 0) {
        event.preventDefault();
        controls[0]!.focus();
        return;
      }
      if (inside && event.shiftKey) {
        event.preventDefault();
        (controlIndex > 0 ? controls[controlIndex - 1]! : item).focus();
        return;
      }
      if (inside && !event.shiftKey && controlIndex >= 0 && controlIndex < controls.length - 1) {
        event.preventDefault();
        controls[controlIndex + 1]!.focus();
        return;
      }
      return;
    }

    if (inside && (key === 'Enter' || key === ' ')) return; // the control acts on itself
    if (inside && key === 'Escape' && item) {
      event.preventDefault();
      item.focus({ preventScroll: true });
      return;
    }

    const next = moveIndex(key, { index: activeIndex, count, columns, ctrlKey });
    if (next !== null) {
      event.preventDefault();
      focusIndex(next);
      return;
    }

    // One-dimensional list view: left/right walk the controls inside the active row.
    if (columns === 1 && item && (key === 'ArrowRight' || key === 'ArrowLeft') && !ctrlKey) {
      if (controls.length === 0) return;
      event.preventDefault();
      if (key === 'ArrowRight') {
        const at = controlIndex < 0 ? -1 : controlIndex;
        controls[Math.min(controls.length - 1, at + 1)]!.focus();
      } else if (controlIndex <= 0) item.focus({ preventScroll: true });
      else controls[controlIndex - 1]!.focus();
      return;
    }

    if (!inside && key === 'Enter' && !ctrlKey) {
      event.preventDefault();
      setSelectedIndex(activeIndex);
      onActivate?.(activeIndex);
      return;
    }
    if (!inside && key === ' ' && buffer.current === '') {
      event.preventDefault();
      setSelectedIndex(activeIndex === selectedIndex ? null : activeIndex);
      return;
    }

    // Type-ahead. Printable single characters only; space extends a live buffer.
    if (ctrlKey || event.altKey || Array.from(key).length !== 1) return;
    if (key === ' ' && buffer.current === '') return;
    buffer.current += key;
    setTypeSequence((sequence) => sequence + 1);
    const match = findTypeAheadMatch(names, buffer.current, activeIndex);
    if (match !== null) {
      event.preventDefault();
      focusIndex(match);
    }
  }

  function getItemProps(index: number): RovingItemProps {
    return {
      ref: (element: HTMLElement | null) => {
        if (element) items.current.set(index, element);
        else items.current.delete(index);
      },
      tabIndex: index === activeIndex ? 0 : -1,
      'aria-selected': index === selectedIndex,
      onFocus: () => setActiveIndex(index),
      onMouseDown: () => {
        setActiveIndex(index);
        setSelectedIndex(index);
      },
    };
  }

  return {
    activeIndex,
    selectedIndex,
    setActiveIndex,
    focusIndex,
    getItemProps,
    containerRef: container,
    containerProps: {
      ref: (element: HTMLElement | null) => {
        container.current = element;
      },
      onKeyDown: handleKeyDown,
    },
  };
}
