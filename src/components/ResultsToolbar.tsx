import { ArrowDown, ArrowUp, LayoutGrid, List } from 'lucide-react';
import type { Sort, View } from '../lib/types';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'modified', label: 'Modified' },
];

export function ResultsToolbar({
  filter,
  setFilter,
  setVisibleCount,
  view,
  setView,
  sort,
  descending,
  changeSort,
}: {
  filter: string;
  setFilter: (value: string) => void;
  setVisibleCount: (value: number) => void;
  view: View;
  setView: (view: View) => void;
  sort: Sort;
  descending: boolean;
  changeSort: (value: Sort) => void;
}) {
  const Direction = descending ? ArrowDown : ArrowUp;
  return (
    <div className="toolbar-group view-controls">
      <label className="sr-only" htmlFor="filter-select">
        Filter by type
      </label>
      <select
        id="filter-select"
        className="control-select"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setVisibleCount(250);
        }}
      >
        <option value="all">All types</option>
        <option value="directory">Folders</option>
        <option value="file">Files</option>
      </select>

      <label className="sr-only" htmlFor="sort-select">
        Sort by
      </label>
      <select
        id="sort-select"
        className="control-select"
        value={sort}
        onChange={(e) => changeSort(e.target.value as Sort)}
      >
        {SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        className="icon-button"
        aria-label={descending ? 'Sort ascending' : 'Sort descending'}
        title={descending ? 'Sort ascending' : 'Sort descending'}
        onClick={() => changeSort(sort)}
      >
        <Direction size={15} aria-hidden="true" />
      </button>

      <div className="view-toggle" role="group" aria-label="View">
        <button
          className={view === 'list' ? 'selected' : ''}
          aria-label="List view"
          title="List view"
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          <List size={15} aria-hidden="true" />
        </button>
        <button
          className={view === 'grid' ? 'selected' : ''}
          aria-label="Grid view"
          title="Grid view"
          aria-pressed={view === 'grid'}
          onClick={() => setView('grid')}
        >
          <LayoutGrid size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
