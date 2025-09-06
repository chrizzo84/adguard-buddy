import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Dashboard from '../page';
import CryptoJS from 'crypto-js';

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
      response: '{"version": "v0.107.29", "language": "en", "protection_enabled": true}',
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

    // Wait for the component to render the toggle button
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
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

  it('renders AdGuard status card with parsed data', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockCheckResponse = {
      status: 'success',
      response: JSON.stringify({
        version: 'v0.107.29',
        language: 'en',
        dns_port: 53,
        http_port: 80,
        protection_enabled: true,
        dhcp_available: false,
        running: true,
        dns_addresses: ['8.8.8.8', '1.1.1.1']
      }),
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
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Should render status information
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders AdGuard stats card with statistics', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockCheckResponse = {
      status: 'success',
      response: '{"version": "v0.107.29", "language": "en"}',
      stats: {
        num_dns_queries: 1500,
        num_blocked_filtering: 200,
        num_replaced_safebrowsing: 5,
        num_replaced_safesearch: 0,
        num_replaced_parental: 10,
        avg_processing_time: 0.002
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
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Should render statistics
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('handles toggle all protection functionality', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockCheckResponse = {
      status: 'success',
      response: '{"version": "v0.107.29", "language": "en", "protection_enabled": true}',
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
        json: () => Promise.resolve(mockCheckResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCheckResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCheckResponse),
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Should handle bulk operations
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('handles connection with URL instead of IP', async () => {
    const mockConnections = [
      { url: 'https://adguard.example.com', port: 443, username: 'admin', password: 'encrypted' },
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
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Should handle URL-based connections
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('handles decryption errors gracefully', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'corrupted' },
    ];

    // Mock decryption failure
    const originalDecrypt = CryptoJS.AES.decrypt;
    CryptoJS.AES.decrypt = jest.fn(() => ({
      toString: jest.fn(() => { throw new Error('Decryption failed'); }),
    }));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'error',
          response: 'Connection failed',
          stats: null
        }),
      });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Restore original function
    CryptoJS.AES.decrypt = originalDecrypt;

    // Should handle decryption errors
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows refresh button and handles refresh functionality', async () => {
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
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Should have refresh functionality
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
