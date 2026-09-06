import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import type { Entry } from '../../shared/types';

/**
 * File families. Each one gets its own icon and its own muted hue token, so the listing reads by
 * shape *and* colour — but never by colour alone: the Type cell (list) and the sr-only kind text
 * (grid) carry the same information as text, and the icon itself is aria-hidden.
 */
export type IconFamily = 'image' | 'video' | 'audio' | 'archive' | 'code' | 'doc' | 'file';

const EXTENSIONS: Record<string, IconFamily> = {};
for (const [family, list] of Object.entries({
  image: 'png jpg jpeg gif svg webp avif bmp heic tiff ico',
  video: 'mp4 mkv avi mov webm m4v mpg mpeg wmv flv',
  audio: 'mp3 flac wav opus m4a ogg aac wma aiff',
  archive: 'zip 7z tar gz bz2 xz rar zst iso',
  code: 'json js jsx ts tsx py rb rs go sh yml yaml toml html css scss sql',
  doc: 'pdf epub txt md rtf doc docx odt xls xlsx csv ppt pptx',
} satisfies Record<Exclude<IconFamily, 'file'>, string>)) {
  for (const extension of list.split(' ')) EXTENSIONS[extension] = family as IconFamily;
}

const ICONS: Record<IconFamily, LucideIcon> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  code: FileCode2,
  doc: FileText,
  file: File,
};

/** The icon family for a file name, ignoring case. Directories are handled by the caller. */
export function iconFamily(name: string): IconFamily {
  const extension = name.split('.').at(-1)?.toLocaleLowerCase() ?? '';
  return EXTENSIONS[extension] ?? 'file';
}

export function EntryIcon({ entry }: { entry: Entry }) {
  const directory = entry.kind === 'directory';
  const family = directory ? 'file' : iconFamily(entry.name);
  const Icon = directory ? Folder : ICONS[family];
  return (
    <span
      className={directory ? 'entry-icon directory' : `entry-icon file ${family}`}
      aria-hidden="true"
    >
      <Icon size={16} strokeWidth={1.75} />
    </span>
  );
}
