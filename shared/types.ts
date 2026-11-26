export interface Entry {
  name: string;
  path: string;
  parent: string;
  kind: 'file' | 'directory';
  size: number;
  modified: number;
  key?: string;
  url: string;
}

export interface Listing {
  path: string;
  entries: Entry[];
  account: string;
  permissions: string[];
}

export interface SearchResults {
  entries: Entry[];
  path: string;
  recursive: boolean;
  scanned: number;
  requested: number;
  more: boolean;
  capped: boolean;
  query: string;
  /** Permissions of `path`, when every entry is directly inside it (current-folder search). */
  permissions?: string[];
}
