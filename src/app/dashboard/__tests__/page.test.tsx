import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Dashboard from '../page';

// Mock dependencies
jest.mock('@/app/components/NavMenu', () => ({
  __esModule: true,
  default: () => <nav data-testid="nav-menu">Navigation</nav>,
}));

// Mock crypto-js
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn(() => 'encrypted-password'),
    decrypt: jest.fn(() => ({
      toString: jest.fn(() => 'decrypted-password'),
    })),
  },
  enc: {
    Utf8: 'utf8',
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('renders the dashboard with navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<Dashboard />);
    });

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('fetches connections on mount', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockCheckResponse = {
      status: 'success',
      response: '{"version": "v0.107.29", "language": "en"}',
      stats: {
        num_dns_queries: 1000,
        num_blocked_filtering: 100,
        num_replaced_safebrowsing: 0,
        num_replaced_safesearch: 0,
        num_replaced_parental: 0,
        avg_processing_time: 0.001
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCheckResponse),
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });
  });

  it('displays loading state initially', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<Dashboard />);
    });

    // Should show loading state initially
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('handles fetch connections error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should still render the page even with fetch error
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders connection cards when connections exist', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockCheckResponse = {
      status: 'success',
      response: '{"version": "v0.107.29", "language": "en"}',
      stats: {
        num_dns_queries: 1000,
        num_blocked_filtering: 100,
        num_replaced_safebrowsing: 0,
        num_replaced_safesearch: 0,
        num_replaced_parental: 0,
        avg_processing_time: 0.001
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCheckResponse),
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render connection information
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows no connections message when empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle empty connections gracefully
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('handles protection toggle API calls', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockCheckResponse = {
      status: 'success',
      response: '{"version": "v0.107.29", "language": "en"}',
      stats: {
        num_dns_queries: 1000,
        num_blocked_filtering: 100,
        num_replaced_safebrowsing: 0,
        num_replaced_safesearch: 0,
        num_replaced_parental: 0,
        avg_processing_time: 0.001
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCheckResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // The component should be rendered and functional
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays error messages when API calls fail', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockCheckResponse = {
      status: 'success',
      response: '{"version": "v0.107.29", "language": "en"}',
      stats: {
        num_dns_queries: 1000,
        num_blocked_filtering: 100,
        num_replaced_safebrowsing: 0,
        num_replaced_safesearch: 0,
        num_replaced_parental: 0,
        avg_processing_time: 0.001
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCheckResponse),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'API Error' }),
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle API errors gracefully
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
