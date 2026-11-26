import { ChevronRight, HardDrive } from 'lucide-react';
import { FolderLink } from './FolderLink';

export function Breadcrumbs({ crumbs }: { crumbs: string[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <FolderLink
            className="crumb-root"
            aria-current={crumbs.length === 0 ? 'page' : undefined}
            aria-label="All files"
            title="All files"
            path="/"
          >
            <HardDrive size={15} aria-hidden="true" />
            <span className="crumb-root-text">All files</span>
          </FolderLink>
        </li>
        {crumbs.map((name, index) => {
          const path = '/' + crumbs.slice(0, index + 1).join('/');
          return (
            <li key={path}>
              <ChevronRight size={13} aria-hidden="true" />
              <FolderLink
                aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                path={path}
              >
                {name}
              </FolderLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
