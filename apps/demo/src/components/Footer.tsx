import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">
        <div className="site-footer__minimal-links">
          <Link to="/impressum">Impressum</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </div>

        <div className="site-footer__bottom">
          <span>&copy; {new Date().getFullYear()} Roger Winkler &amp; Andrea Rossi</span>
        </div>
      </div>
    </footer>
  );
}
