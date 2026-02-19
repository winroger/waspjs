import React from 'react';
import logoUrl from '../assets/logo.png';

type NavbarProps = {
  onOpenDatasets: () => void;
};

export function Navbar({ onOpenDatasets }: NavbarProps) {

  return (
    <nav className="navbar" role="navigation" aria-label="main navigation">
      <div className="navbar-brand">
        <a className="navbar-item" aria-label="WaspJS home">
          <img src={logoUrl} alt="WaspJS logo" className="brand-mark" />
        </a>
      </div>
      <div className="navbar__actions">
        <a
          className="navbar__github-link"
          href="https://github.com/winroger/waspjs"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Open GitHub repository"
          title="GitHub"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-.95-2.7-.95-.36-.92-.9-1.17-.9-1.17-.73-.5.05-.49.05-.49.82.06 1.24.83 1.24.83.7 1.21 1.9.86 2.36.66.08-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.98 0-.88.31-1.6.82-2.16-.08-.2-.36-1.01.08-2.11 0 0 .67-.21 2.2.83a7.65 7.65 0 0 1 4 0c1.52-1.04 2.2-.83 2.2-.83.44 1.1.16 1.9.08 2.1.51.57.82 1.29.82 2.17 0 3.1-1.88 3.78-3.67 3.98.28.24.54.72.54 1.46v2.17c0 .21.14.45.55.38A8 8 0 0 0 8 0Z" />
          </svg>
        </a>
        <button className="navbar__datasets-btn" onClick={onOpenDatasets} aria-label="Open datasets">
          Datasets
        </button>
      </div>
    </nav>
  );
}
