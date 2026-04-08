import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function ImpressumPage() {
  return (
    <div className="legal-page">
      <Navbar />
      <main className="legal-page__content">
        <h1 className="legal-page__title">Impressum</h1>

        <section className="legal-page__section">
          <h2>Responsible for content</h2>
          <p>
            <strong className="legal-page__name">Roger Winkler</strong><br />
            Email:{' '}
            <a href="mailto:hello@rogerwinkler.de">hello@rogerwinkler.de</a><br />
            Web:{' '}
            <a href="https://www.rogerwinkler.de" target="_blank" rel="noreferrer noopener">
              rogerwinkler.de
            </a>
          </p>
          <p>
            <strong className="legal-page__name">Andrea Rossi</strong><br />
            Email:{' '}
            <a href="mailto:a.rossi.andrea@gmail.com">a.rossi.andrea@gmail.com</a><br />
            Web:{' '}
            <a href="https://thecomputationalhive.com/" target="_blank" rel="noreferrer noopener">
              thecomputationalhive.com
            </a>
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Disclaimer</h2>
          <p>
            The content of this website has been created with care. However, we
            cannot guarantee the accuracy, completeness, or timeliness of the
            content. As a non-commercial, open-source project, we are not
            obligated under general law to monitor transmitted or stored
            third-party information or to investigate circumstances indicating
            illegal activity.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>External links</h2>
          <p>
            This website contains links to external third-party websites over
            whose content we have no influence. We cannot therefore accept any
            liability for this external content. The respective provider or
            operator of the linked pages is always responsible for the content of
            those pages.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Open source</h2>
          <p>
            WASP Atlas is open source and split into two repositories:
            <br />
            <a href="https://github.com/winroger/waspjs" target="_blank" rel="noreferrer noopener">
              WaspJS
            </a>{' '}
            contains the reusable assembly engine and core logic.
            <br />
            <a href="https://github.com/Wasp-Framework/Wasp-Atlas" target="_blank" rel="noreferrer noopener">
              Wasp Atlas
            </a>{' '}
            contains the website/app, datasets, and project presentation around that engine.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
