export type Connection = { server: string; url: string };
export type Place = { path: string; name: string };
export type Sort = 'name' | 'size' | 'modified';
export type Route = { path: string; q: string; recursive: boolean; limit: number };
export type View = 'list' | 'grid';
