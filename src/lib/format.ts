import type { Entry } from '../../shared/types';

export function parentOf(path: string) {
  return path.slice(0, path.lastIndexOf('/')) || '/';
}
export function bytes(size: number) {
  if (!size) return '0 B';
  const power = Math.min(4, Math.floor(Math.log(size) / Math.log(1024)));
  return `${(size / 1024 ** power).toLocaleString(undefined, { maximumFractionDigits: power ? 1 : 0 })} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][power]}`;
}
/** `plural(1, 'folder')` → `1 folder`; `plural(12, 'folder')` → `12 folders`. */
export function plural(count: number, singular: string, many = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : many}`;
}
export function fileKind(entry: Entry) {
  if (entry.kind === 'directory') return 'Folder';
  const ext = entry.name.split('.').at(-1)?.toLowerCase() ?? '';
  return ext === entry.name.toLowerCase() ? 'File' : `${ext.toUpperCase()} file`;
}
