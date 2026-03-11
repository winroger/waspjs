// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

/* ── Stub heavy child pages so the test stays fast ── */
vi.mock('./pages/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page">Landing</div>,
}));
vi.mock('./pages/BuildScreen', () => ({
  BuildScreen: () => <div data-testid="build-screen">Build</div>,
}));

describe('App routing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the landing page at "/"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('landing-page')).toBeTruthy();
  });

  it('renders the build screen at "/build/:slug"', () => {
    render(
      <MemoryRouter initialEntries={['/build/example_brio_chamfer']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('build-screen')).toBeTruthy();
  });

  it('redirects unknown routes to "/"', () => {
    render(
      <MemoryRouter initialEntries={['/some/unknown/path']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('landing-page')).toBeTruthy();
  });
});
