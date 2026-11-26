import { Clock3, Folder, HardDrive, Keyboard, LogOut } from 'lucide-react';
import { FolderLink } from './FolderLink';
import { Logo } from './Logo';
import type { Connection, Place, Route } from '../lib/types';
import type { Entry } from '../../shared/types';

export function Sidebar({
  route,
  volumes,
  recent,
  connection,
  onDisconnect,
  onShowShortcuts,
}: {
  route: Route;
  volumes: Entry[];
  recent: Place[];
  connection: Connection | null;
  onDisconnect: () => void;
  onShowShortcuts: () => void;
}) {
  const inVolume = (path: string) => route.path === path || route.path.startsWith(path + '/');
  return (
    <aside className="sidebar">
      <FolderLink className="brand" path="/">
        <Logo />
      </FolderLink>
      <nav className="sidebar-nav" aria-label="Locations">
        <div className="nav-section">
          <FolderLink
            className={`nav-item ${route.path === '/' ? 'active' : ''}`}
            aria-current={route.path === '/' ? 'page' : undefined}
            path="/"
          >
            <HardDrive size={16} aria-hidden="true" />
            <span>All files</span>
          </FolderLink>
        </div>
        {volumes.length > 0 && (
          <div className="nav-section volume-nav">
            <p className="nav-label" id="nav-volumes">
              Volumes
            </p>
            <ul aria-labelledby="nav-volumes">
              {volumes.map((volume) => (
                <li key={volume.path}>
                  <FolderLink
                    className={`nav-item ${inVolume(volume.path) ? 'active' : ''}`}
                    aria-current={route.path === volume.path ? 'page' : undefined}
                    path={volume.path}
                  >
                    <Folder size={16} aria-hidden="true" />
                    <span>{volume.name}</span>
                  </FolderLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        {recent.length > 0 && (
          <div className="nav-section recent-nav">
            <p className="nav-label" id="nav-recent">
              Recent folders
            </p>
            <ul aria-labelledby="nav-recent">
              {recent.map((place) => (
                <li key={place.path}>
                  <FolderLink
                    className={`nav-item recent-item ${route.path === place.path ? 'active' : ''}`}
                    aria-current={route.path === place.path ? 'page' : undefined}
                    path={place.path}
                  >
                    <Clock3 size={16} aria-hidden="true" />
                    <span className="recent-text">
                      <span className="recent-name">{place.name}</span>
                      <span className="recent-path">{place.path}</span>
                    </span>
                  </FolderLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
      <div className="sidebar-bottom">
        {connection?.server && <p className="server-caption">Connected to {connection.server}</p>}
        <button className="nav-item signout" onClick={onShowShortcuts}>
          <Keyboard size={16} aria-hidden="true" />
          <span>Keyboard shortcuts</span>
        </button>
        <button className="nav-item signout" onClick={onDisconnect}>
          <LogOut size={16} aria-hidden="true" />
          <span>Disconnect</span>
        </button>
      </div>
    </aside>
  );
}
