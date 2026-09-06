import { ChevronRight, HardDrive } from 'lucide-react';

export function Breadcrumbs({
  crumbs,
  openFolder,
}: {
  crumbs: string[];
  openFolder: (path: string) => void;
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <button
            className="crumb-root"
            aria-current={crumbs.length === 0 ? 'page' : undefined}
            aria-label="All files"
            title="All files"
            onClick={() => openFolder('/')}
          >
            <HardDrive size={15} aria-hidden="true" />
            <span className="crumb-root-text">All files</span>
          </button>
        </li>
        {crumbs.map((name, index) => {
          const path = '/' + crumbs.slice(0, index + 1).join('/');
          return (
            <li key={path}>
              <ChevronRight size={13} aria-hidden="true" />
              <button
                aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                onClick={() => openFolder(path)}
              >
                {name}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
