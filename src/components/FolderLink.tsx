import { createContext, use, type AnchorHTMLAttributes } from 'react';
import { folderRoute, isPlainClick, routeHref } from '../lib/links';
import type { Route } from '../lib/types';

/** How folder links navigate: App provides the current route and `openFolder`. */
export const FolderNavigation = createContext<{
  route: Route;
  openFolder: (path: string) => void;
} | null>(null);

/**
 * A real link to a folder inside the app. A plain click navigates in place
 * through `openFolder`; Cmd/Ctrl-click, middle-click, Shift-click, "Copy link"
 * and "Open in new tab" all work because the `href` is the folder's own URL.
 */
export function FolderLink({
  path,
  onClick,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { path: string }) {
  const navigation = use(FolderNavigation);
  if (!navigation) throw new Error('FolderLink must be rendered inside FolderNavigation.');
  const { route, openFolder } = navigation;
  return (
    <a
      {...props}
      href={routeHref(folderRoute(route, path))}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainClick(event)) return;
        event.preventDefault();
        openFolder(path);
      }}
    />
  );
}
