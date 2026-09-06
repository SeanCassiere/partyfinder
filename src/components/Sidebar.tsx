import { Clock3, Folder, HardDrive, Keyboard, LogOut } from 'lucide-react';
import { Logo } from './Logo';
import type { Connection, Place, Route } from '../lib/types';
import type { Entry } from '../../shared/types';

export function Sidebar({
  route,
  volumes,
  recent,
  connection,
  openFolder,
  onDisconnect,
  onShowShortcuts,
}: {
  route: Route;
  volumes: Entry[];
  recent: Place[];
  connection: Connection | null;
  openFolder: (path: string) => void;
  onDisconnect: () => void;
  onShowShortcuts: () => void;
}) {
  const inVolume = (path: string) => route.path === path || route.path.startsWith(path + '/');
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="/"
        onClick={(event) => {
          event.preventDefault();
          openFolder('/');
        }}
      >
        <Logo />
      </a>
      <nav className="sidebar-nav" aria-label="Locations">
        <div className="nav-section">
          <button
            className={`nav-item ${route.path === '/' ? 'active' : ''}`}
            aria-current={route.path === '/' ? 'page' : undefined}
            onClick={() => openFolder('/')}
          >
            <HardDrive size={16} aria-hidden="true" />
            <span>All files</span>
          </button>
        </div>
        {volumes.length > 0 && (
          <div className="nav-section volume-nav">
            <p className="nav-label" id="nav-volumes">
              Volumes
            </p>
            <ul aria-labelledby="nav-volumes">
              {volumes.map((volume) => (
                <li key={volume.path}>
                  <button
                    className={`nav-item ${inVolume(volume.path) ? 'active' : ''}`}
                    aria-current={route.path === volume.path ? 'page' : undefined}
                    onClick={() => openFolder(volume.path)}
                  >
                    <Folder size={16} aria-hidden="true" />
                    <span>{volume.name}</span>
                  </button>
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
                  <button
                    className={`nav-item recent-item ${route.path === place.path ? 'active' : ''}`}
                    aria-current={route.path === place.path ? 'page' : undefined}
                    onClick={() => openFolder(place.path)}
                  >
                    <Clock3 size={16} aria-hidden="true" />
                    <span className="recent-text">
                      <span className="recent-name">{place.name}</span>
                      <span className="recent-path">{place.path}</span>
                    </span>
                  </button>
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
