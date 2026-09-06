import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { MenuTarget } from '../components/EntryMenu';
import type { Entry } from '../../shared/types';

export type EntryContextProps = {
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export function useEntryMenu() {
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  function contextProps(entry: Entry): EntryContextProps {
    return {
      onContextMenu: (event) => {
        event.preventDefault();
        setMenu({ entry, x: event.clientX, y: event.clientY });
      },
      onKeyDown: (event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu({ entry, x: rect.left + 24, y: rect.top + 24 });
        }
      },
    };
  }
  /**
   * Open the menu anchored to a control (the row's "…" button). The menu
   * measures itself and flips to stay in the viewport, so no caller has to
   * know its size — prefer this over computing an offset by hand.
   */
  function openMenuAt(entry: Entry, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    setMenu({ entry, x: rect.right, y: rect.bottom + 2, align: 'end' });
  }
  return { menu, setMenu, contextProps, openMenuAt };
}
