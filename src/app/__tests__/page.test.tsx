import { render, screen } from '@testing-library/react';
import Home from '../page';

// Mock dependencies (though Home has none now except next/link which works in Jest usually, or might need simple mock if strictly unit)
// Next/link usually renders as a <a> tag in tests if not mocked, which is fine.

describe('Home', () => {
  it('renders the main heading', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1 });
    // Text might be split into spans, so we check for content
    expect(heading).toHaveTextContent(/Welcome to/i);
    expect(heading).toHaveTextContent(/AdGuard Buddy/i);
  });

  it('renders the description paragraph', () => {
    render(<Home />);
    expect(screen.getByText(/A powerful tool to manage and synchronize your AdGuard Home instances/i)).toBeInTheDocument();
  });

  it('renders quick navigation links', () => {
    render(<Home />);

    // Check for specific links (Dashboard appears twice: in card and getting started)
    const dashboardLinks = screen.getAllByRole('link', { name: /Dashboard/i });
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(1);
    expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard');

    expect(screen.getByRole('link', { name: /Query Log/i })).toHaveAttribute('href', '/query-log');
    expect(screen.getByRole('link', { name: /Statistics/i })).toHaveAttribute('href', '/statistics');
    expect(screen.getByRole('link', { name: /Sync Status/i })).toHaveAttribute('href', '/sync-status');

    // Check for Settings links (appears twice: in card and getting started)
    const settingsLinks = screen.getAllByRole('link', { name: /Settings/i });
    expect(settingsLinks.length).toBeGreaterThanOrEqual(1);
    expect(settingsLinks[0]).toHaveAttribute('href', '/settings');
  });

  it('renders Getting Started guide', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 2, name: /Getting Started/i })).toBeInTheDocument();
    expect(screen.getByText(/Set a master server for synchronization/i)).toBeInTheDocument();
  });
});
