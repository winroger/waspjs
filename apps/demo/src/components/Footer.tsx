import React from 'react';
import { Link } from 'react-router-dom';

const BASE = import.meta.env.BASE_URL ?? '/';

export function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <img
            src={`${BASE}assets/waspatlas.png`}
            alt="WASP Atlas logo"
            className="site-footer__logo"
          />
          <p className="site-footer__tagline">
            An open library of modular building systems designed with the
            Grasshopper plug-in WASP.
          </p>
        </div>

        <div className="site-footer__col">
          <h3 className="site-footer__heading">Resources</h3>
          <ul className="site-footer__links">
            <li>
              <a href="https://github.com/winroger/waspjs" target="_blank" rel="noreferrer noopener">
                WASP Atlas GitHub
              </a>
            </li>
            <li>
              <a href="https://github.com/ar0551/Wasp" target="_blank" rel="noreferrer noopener">
                WASP Plugin GitHub
              </a>
            </li>
            <li>
              <a href="https://www.food4rhino.com/en/app/wasp" target="_blank" rel="noreferrer noopener">
                Food4Rhino
              </a>
            </li>
          </ul>
        </div>

        <div className="site-footer__col">
          <h3 className="site-footer__heading">Legal</h3>
          <ul className="site-footer__links">
            <li><Link to="/impressum">Impressum</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li>
              <a href="mailto:hello@rogerwinkler.de">Contact</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>&copy; {new Date().getFullYear()} Roger Winkler &amp; Andrea Rossi</span>
      </div>
    </footer>
  );
}
