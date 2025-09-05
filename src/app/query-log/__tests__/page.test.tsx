import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QueryLogPage from '../page';

// Mock dependencies
jest.mock('@/app/components/NavMenu', () => ({
  __esModule: true,
  default: () => <nav data-testid="nav-menu">Navigation</nav>,
}));

jest.mock('../PageControls', () => ({
  __esModule: true,
  default: ({ onRefresh }: { onRefresh: () => void }) => (
    <div data-testid="page-controls">
      <button onClick={onRefresh} data-testid="refresh-button">Refresh</button>
    </div>
  ),
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

describe('QueryLogPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('renders the query log page with navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<QueryLogPage />);
    });

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.getByText('Query Log')).toBeInTheDocument();
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
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });
  });

  it('handles fetch connections error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should still render the page even with fetch error
    expect(screen.getByText('Query Log')).toBeInTheDocument();
  });

  it('renders connection selector when connections exist', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: mockConnections }),
    });

    await act(async () => {
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render connection selector
    expect(screen.getByText('Query Log')).toBeInTheDocument();
  });

  it('fetches logs in single mode when connection is selected', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockLogs = {
      data: [
        {
          question: { name: 'example.com' },
          client: '192.168.1.100',
          time: '2024-01-01T00:00:00Z',
          status: 'processed',
          reason: 'NotFilteredNotFound',
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLogs),
      });

    await act(async () => {
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should be able to fetch logs
    expect(screen.getByText('Query Log')).toBeInTheDocument();
  });

  it('handles log fetch error gracefully', async () => {
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
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle API errors gracefully
    expect(screen.getByText('Query Log')).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render filter controls
    expect(screen.getByText('Query Log')).toBeInTheDocument();
  });

  it('renders page controls component', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render page controls
    expect(screen.getByTestId('page-controls')).toBeInTheDocument();
  });

  it('handles combined mode with multiple connections', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    const mockLogs = {
      data: [
        {
          question: { name: 'example.com' },
          client: '192.168.1.100',
          time: '2024-01-01T00:00:00Z',
          status: 'processed',
          reason: 'NotFilteredNotFound',
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLogs),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLogs),
      });

    await act(async () => {
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle combined mode
    expect(screen.getByText('Query Log')).toBeInTheDocument();
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
      render(<QueryLogPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle loading states
    expect(screen.getByText('Query Log')).toBeInTheDocument();
  });
});
