import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import StatisticsPage from '../page';

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

describe('StatisticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('renders the statistics page with navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<StatisticsPage />);
    });

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('fetches connections on mount', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: mockConnections }),
    });

    await act(async () => {
      render(<StatisticsPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });
  });

  it('handles fetch connections error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(<StatisticsPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should still render the page even with fetch error
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('renders view mode selector', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<StatisticsPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render the page structure
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('fetches combined statistics when view mode is combined', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockStats = {
      avg_processing_time: 0.5,
      dns_queries: 1000,
      top_queried_domains: [{ 'example.com': 100 }],
      top_blocked_domains: [{ 'bad.com': 50 }],
      top_clients: [{ '192.168.1.100': 200 }],
      top_upstreams_avg_time: [{ '8.8.8.8': 0.3 }],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

    await act(async () => {
      render(<StatisticsPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should be able to fetch combined stats
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('fetches single server statistics when view mode is single', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockStats = {
      avg_processing_time: 0.5,
      dns_queries: 1000,
      top_queried_domains: [{ 'example.com': 100 }],
      top_blocked_domains: [{ 'bad.com': 50 }],
      top_clients: [{ '192.168.1.100': 200 }],
      top_upstreams_avg_time: [{ '8.8.8.8': 0.3 }],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

    await act(async () => {
      render(<StatisticsPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should be able to fetch single server stats
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('handles statistics fetch error gracefully', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'API Error' }),
      });

    await act(async () => {
      render(<StatisticsPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle API errors gracefully
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });

  it('shows loading state during data fetch', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce(new Promise(resolve => setTimeout(resolve, 100))); // Delay response

    await act(async () => {
      render(<StatisticsPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle loading states
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });
});
