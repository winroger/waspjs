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
      <button className="navbar__datasets-btn" onClick={onOpenDatasets} aria-label="Open datasets">
        Datasets
      </button>
    </nav>
  );
}
