import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import NavMenu from '../NavMenu';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('NavMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all navigation links', () => {
    mockUsePathname.mockReturnValue('/');

    render(<NavMenu />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Query Log')).toBeInTheDocument();
    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('Sync Status')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('applies active styling to current page link', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    render(<NavMenu />);

    const dashboardLink = screen.getByText('Dashboard');
    expect(dashboardLink).toHaveClass('text-neon');

    // Check for the active indicator
    const activeIndicator = dashboardLink.parentElement?.querySelector('.bg-\\[var\\(--primary\\)\\]');
    expect(activeIndicator).toBeInTheDocument();
  });

  it('applies inactive styling to non-current page links', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    render(<NavMenu />);

    const settingsLink = screen.getByText('Settings');
    expect(settingsLink).toHaveClass('text-gray-400');
    expect(settingsLink).toHaveClass('hover:text-white');
  });

  it('renders navigation links with correct href attributes', () => {
    mockUsePathname.mockReturnValue('/');

    render(<NavMenu />);

    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Query Log').closest('a')).toHaveAttribute('href', '/query-log');
    expect(screen.getByText('Statistics').closest('a')).toHaveAttribute('href', '/statistics');
    expect(screen.getByText('Sync Status').closest('a')).toHaveAttribute('href', '/sync-status');
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings');
  });
});
