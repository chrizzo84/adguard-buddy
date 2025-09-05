import { render, screen, fireEvent } from '@testing-library/react';
import { SiteFooter } from '../SiteFooter';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Github: () => <svg data-testid="github-icon" />,
}));

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('SiteFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders copyright with current year', () => {
    const currentYear = new Date().getFullYear();
    render(<SiteFooter />);

    expect(screen.getByText(`© ${currentYear} chrizzo84`)).toBeInTheDocument();
  });

  it('renders GitHub profile link with correct attributes', () => {
    render(<SiteFooter />);

    const profileLink = screen.getByLabelText('GitHub Profile chrizzo84');
    expect(profileLink).toHaveAttribute('href', 'https://github.com/chrizzo84');
    expect(profileLink).toHaveAttribute('target', '_blank');
    expect(profileLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders repository link with correct attributes', () => {
    render(<SiteFooter />);

    const repoLink = screen.getByLabelText('Repository adguard-buddy');
    expect(repoLink).toHaveAttribute('href', 'https://github.com/chrizzo84/adguard-buddy');
    expect(repoLink).toHaveAttribute('target', '_blank');
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders GitHub icons', () => {
    render(<SiteFooter />);

    const icons = screen.getAllByTestId('github-icon');
    expect(icons).toHaveLength(2);
  });

  it('renders "What\'s New" button', () => {
    render(<SiteFooter />);

    const newsButton = screen.getByLabelText("Open What's New");
    expect(newsButton).toBeInTheDocument();
    expect(newsButton).toHaveTextContent("What's New");
  });

  it('dispatches custom event when "What\'s New" button is clicked', () => {
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');

    render(<SiteFooter />);

    const newsButton = screen.getByLabelText("Open What's New");
    fireEvent.click(newsButton);

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'adguard-buddy:open-news',
      })
    );

    dispatchEventSpy.mockRestore();
  });

  it('handles window undefined gracefully', () => {
    // Mock window as undefined
    const originalWindow = global.window;
    delete (global as any).window;

    render(<SiteFooter />);

    const newsButton = screen.getByLabelText("Open What's New");
    expect(() => fireEvent.click(newsButton)).not.toThrow();

    // Restore window
    global.window = originalWindow;
  });
});
