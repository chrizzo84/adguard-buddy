import { render, screen } from '@testing-library/react';
import Home from '../page';

// Mock NavMenu component
jest.mock('../components/NavMenu', () => ({
  __esModule: true,
  default: () => <nav data-testid="nav-menu">Navigation Menu</nav>,
}));

describe('Home', () => {
  it('renders the main heading', () => {
    render(<Home />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('AdGuard Buddy');
    expect(heading).toHaveClass('text-2xl');
    expect(heading).toHaveClass('font-bold');
    expect(heading).toHaveClass('mb-6');
    expect(heading).toHaveClass('text-center');
  });

  it('renders the welcome message', () => {
    render(<Home />);

    const paragraph = screen.getByText('Welcome! Use the menu to manage settings or view the dashboard.');
    expect(paragraph).toHaveClass('text-center');
    expect(paragraph).toHaveClass('text-gray-600');
    expect(paragraph).toHaveClass('mb-8');
  });

  it('renders the NavMenu component', () => {
    render(<Home />);

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
  });

  it('renders with correct container styling', () => {
    render(<Home />);

    const container = screen.getByText('AdGuard Buddy').closest('div');
    expect(container).toHaveClass('max-w-lg');
    expect(container).toHaveClass('mx-auto');
    expect(container).toHaveClass('p-8');
  });

  it('renders all content in correct order', () => {
    render(<Home />);

    const container = screen.getByText('AdGuard Buddy').closest('div');
    const children = container?.children;

    expect(children?.[0]).toHaveAttribute('data-testid', 'nav-menu');
    expect(children?.[1]).toHaveRole('heading');
    expect(children?.[2]).toHaveTextContent('Welcome! Use the menu to manage settings or view the dashboard.');
  });
});
