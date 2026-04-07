import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';

export function AboutPage() {
  return (
    <div className="about-page">
      <Navbar />

      <main className="about-page__main">
        <section className="about-page__center" aria-label="About Wasp Atlas">
          <h1 className="about-page__center-title">About</h1>
          <div className="about-page__break" aria-hidden="true" />
          <p className="about-page__center-text">
            <a className="about-page__inline-link" href="https://github.com/Wasp-Framework/Wasp-Atlas" target="_blank" rel="noreferrer noopener">Wasp Atlas</a>{' '}
            is a growing open library of modular building systems designed with the Grasshopper
            plug-in WASP, a combinatorial toolkit for discrete design.
            The plugin by{' '}
            <a className="about-page__inline-link" href="https://www.linkedin.com/in/ar0551/" target="_blank" rel="noreferrer noopener">Andrea Rossi</a>{' '}
            is{' '}
            <a className="about-page__inline-link" href="https://github.com/ar0551/Wasp" target="_blank" rel="noreferrer noopener">open source</a>{' '}
            and available on{' '}
            <a className="about-page__inline-link" href="https://www.food4rhino.com/en/app/wasp" target="_blank" rel="noreferrer noopener">Food4Rhino</a>.
            The aggregation concepts have been ported to{' '}
            <a className="about-page__inline-link" href="https://github.com/winroger/waspjs" target="_blank" rel="noreferrer noopener">WaspJS</a>{' '}
            by{' '}
            <a className="about-page__inline-link" href="https://www.linkedin.com/in/rogerwinkler/" target="_blank" rel="noreferrer noopener">Roger Winkler</a>{' '}
            and are still under development.
            Wasp Atlas is still evolving, so suggestions, feedback, and questions are welcome.
          </p>
          <div className="about-page__center-links">
            <Link className="about-page__feedback-cta about-page__feedback-cta--primary" to="/datasets">
              Explore datasets
            </Link>
            <a className="about-page__feedback-cta" href="mailto:hello@rogerwinkler.de">
              Get in touch ↗
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
