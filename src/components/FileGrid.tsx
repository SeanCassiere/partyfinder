import { useEffect, useState } from 'react';
import { EntryName, EntryRowActions, activateEntry, type EntryActions } from './EntryRow';
import { useRovingFocus } from '../hooks/useRovingFocus';
import { bytes, fileKind } from '../lib/format';
import type { Entry } from '../../shared/types';

export function FileGrid({
  entries,
  total,
  listKey,
  actions,
}: {
  entries: Entry[];
  total?: number;
  listKey?: string;
  actions: EntryActions;
}) {
  const [columns, setColumns] = useState(1);
  const roving = useRovingFocus({
    count: entries.length,
    columns,
    names: entries.map((entry) => entry.name),
    resetKey: listKey ?? '',
    onActivate: (index) => {
      const entry = entries[index];
      if (entry) activateEntry(entry, actions);
    },
  });
  const { containerRef } = roving;

  // The column count is a layout fact, so it is measured after paint, never during render.
  // Row wrappers below use `display: contents`, so the measured track count stays correct.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const tracks = getComputedStyle(element)
        .gridTemplateColumns.split(' ')
        .filter(Boolean).length;
      setColumns(Math.max(1, tracks));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  const rows: Entry[][] = [];
  for (let start = 0; start < entries.length; start += columns) {
    rows.push(entries.slice(start, start + columns));
  }

  return (
    <div
      className="file-grid"
      role="grid"
      aria-multiselectable="false"
      aria-rowcount={Math.ceil((total ?? entries.length) / Math.max(1, columns))}
      {...roving.containerProps}
    >
      {rows.map((row, rowIndex) => (
        <div className="file-grid-row" role="row" aria-rowindex={rowIndex + 1} key={rowIndex}>
          {row.map((entry, cell) => {
            const index = rowIndex * columns + cell;
            return (
              <article
                className="file-card"
                role="gridcell"
                key={entry.path}
                // EntryMenu restores focus to the card by path after a rename or delete.
                data-entry-path={entry.path}
                {...actions.contextProps(entry)}
                {...roving.getItemProps(index)}
                onDoubleClick={() => activateEntry(entry, actions)}
              >
                <EntryName entry={entry} actions={actions} />
                <div className="card-meta">
                  <span className="card-kind">
                    {entry.kind === 'directory'
                      ? 'Folder'
                      : `${fileKind(entry)} \u00b7 ${bytes(entry.size)}`}
                  </span>
                  <EntryRowActions entry={entry} actions={actions} copyLink />
                </div>
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}
