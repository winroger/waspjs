import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function PrivacyPage() {
  return (
    <div className="legal-page">
      <Navbar />
      <main className="legal-page__content">
        <h1 className="legal-page__title">Privacy Policy</h1>

        <section className="legal-page__section">
          <h2>Overview</h2>
          <p>
            WASP Atlas is a static, open-source website. We take your privacy
            seriously and have designed this site to collect as little data as
            possible.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Data collection</h2>
          <p>
            This website does <strong>not</strong> use cookies, analytics
            services, tracking pixels, or any other form of user tracking. No
            personal data is collected, stored, or processed when you visit this
            site.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Hosting</h2>
          <p>
            This website is hosted on GitHub Pages. GitHub may collect technical
            data such as IP addresses in server logs as part of their hosting
            service. For details, see the{' '}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub Privacy Statement
            </a>.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>External links</h2>
          <p>
            This site contains links to external websites (GitHub, Food4Rhino,
            Google Forms). These third-party sites have their own privacy
            policies, and we have no control over their data practices.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Contact</h2>
          <p>
            If you have questions about this privacy policy, please contact us at{' '}
            <a href="mailto:hello@rogerwinkler.de">hello@rogerwinkler.de</a>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
