import { render, screen } from '@testing-library/react';
import RootLayout from '../layout';

// Mock Next.js fonts
jest.mock('next/font/google', () => ({
  Geist: jest.fn(() => ({
    variable: '--font-geist-sans',
    subsets: ['latin'],
  })),
  Geist_Mono: jest.fn(() => ({
    variable: '--font-geist-mono',
    subsets: ['latin'],
  })),
}));

// Mock components
jest.mock('../components/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-providers">{children}</div>
  ),
}));

jest.mock('../components/SiteFooter', () => ({
  SiteFooter: () => <footer data-testid="site-footer" />,
}));

describe('RootLayout', () => {
  it('renders AppProviders wrapper', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    expect(screen.getByTestId('app-providers')).toBeInTheDocument();
  });

  it('renders main content area with flex layout', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-grow');
    expect(main).toHaveTextContent('Test Content');
  });

  it('renders SiteFooter', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
  });

  it('renders flex column layout container', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    const container = screen.getByTestId('app-providers').firstChild;
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('flex-col');
    expect(container).toHaveClass('min-h-screen');
  });

  it('renders with proper semantic HTML structure', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    // Check that we have the expected semantic elements
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
  });
});
