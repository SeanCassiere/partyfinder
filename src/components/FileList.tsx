import { ArrowDown } from 'lucide-react';
import { EntryName, EntryRowActions, activateEntry, type EntryActions } from './EntryRow';
import { useRovingFocus } from '../hooks/useRovingFocus';
import { bytes, fileKind } from '../lib/format';
import type { Sort } from '../lib/types';
import type { Entry } from '../../shared/types';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

function SortHeader({
  column,
  label,
  className,
  sort,
  descending,
  changeSort,
}: {
  column: Sort;
  label: string;
  className?: string;
  sort: Sort;
  descending: boolean;
  changeSort: (value: Sort) => void;
}) {
  const active = sort === column;
  const direction = descending ? 'descending' : 'ascending';
  return (
    <th
      role="columnheader"
      scope="col"
      className={className}
      aria-sort={active ? direction : 'none'}
    >
      <button type="button" onClick={() => changeSort(column)}>
        {label}
        {active && (
          <ArrowDown size={13} aria-hidden="true" className={descending ? '' : 'sort-up'} />
        )}
        <span className="sr-only">{active ? `, sorted ${direction}` : ', not sorted'}</span>
      </button>
    </th>
  );
}

export function FileList({
  entries,
  total,
  listKey,
  sort,
  descending,
  changeSort,
  actions,
}: {
  /** The rows actually rendered (App slices to `visibleCount`). */
  entries: Entry[];
  /** Rows in the full listing, for `aria-rowcount`. Defaults to the rendered count. */
  total?: number;
  /** Identity of the listing (folder, query, filter). Changing it parks focus back at the top. */
  listKey?: string;
  sort: Sort;
  descending: boolean;
  changeSort: (value: Sort) => void;
  actions: EntryActions;
}) {
  const roving = useRovingFocus({
    count: entries.length,
    columns: 1,
    names: entries.map((entry) => entry.name),
    resetKey: `${listKey ?? ''}|${sort}|${descending}`,
    onActivate: (index) => {
      const entry = entries[index];
      if (entry) activateEntry(entry, actions);
    },
  });

  return (
    <div className="table-scroll">
      <table
        role="grid"
        aria-multiselectable="false"
        aria-rowcount={(total ?? entries.length) + 1}
        {...roving.containerProps}
      >
        <thead>
          <tr role="row" aria-rowindex={1}>
            <SortHeader
              column="name"
              label="Name"
              sort={sort}
              descending={descending}
              changeSort={changeSort}
            />
            <th role="columnheader" scope="col" className="type-column">
              Type
            </th>
            <SortHeader
              column="size"
              label="Size"
              className="size-column"
              sort={sort}
              descending={descending}
              changeSort={changeSort}
            />
            <SortHeader
              column="modified"
              label="Modified"
              className="date-column"
              sort={sort}
              descending={descending}
              changeSort={changeSort}
            />
            <th role="columnheader" scope="col" className="actions-column">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={entry.path}
              role="row"
              aria-rowindex={index + 2}
              // EntryMenu restores focus to the row by path after a rename or delete.
              data-entry-path={entry.path}
              {...actions.contextProps(entry)}
              {...roving.getItemProps(index)}
              onDoubleClick={() => activateEntry(entry, actions)}
            >
              <td role="gridcell">
                <EntryName entry={entry} actions={actions} />
              </td>
              <td role="gridcell" className="type-column">
                {fileKind(entry)}
              </td>
              <td role="gridcell" className="size-column">
                {entry.kind === 'directory' ? '—' : bytes(entry.size)}
              </td>
              <td role="gridcell" className="date-column">
                {entry.modified
                  ? new Date(entry.modified * 1000).toLocaleDateString(undefined, DATE_FORMAT)
                  : '—'}
              </td>
              <td role="gridcell">
                <EntryRowActions entry={entry} actions={actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
