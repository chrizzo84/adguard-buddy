import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import SyncStatusPage from '../page';

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

// Helper function to mock auto-sync config response
const mockAutoSyncConfigResponse = () => ({
  ok: true,
  json: () => Promise.resolve({ 
    config: {
      enabled: false, 
      interval: '0 */6 * * *',
      categories: [],
      paused: false
    },
    isRunning: false, 
    isPaused: false, 
    nextSync: null, 
    recentLogs: []
  }),
});

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: jest.fn(),
});

describe('SyncStatusPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    
    // Default: Mock /api/auto-sync-config to avoid unhandled fetch errors
    mockFetch.mockImplementation((url) => {
      if (url === '/api/auto-sync-config') {
        return Promise.resolve(mockAutoSyncConfigResponse());
      }
      if (url === '/api/get-connections') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connections: [], masterServerIp: null }),
        });
      }
      // Return a rejected promise for unmocked URLs
      return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
    });
  });

  it('renders the sync status page with navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [] }),
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.getByText('Sync Status')).toBeInTheDocument();
  });

  it('fetches connections on mount', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: mockConnections, masterServerIp: '192.168.1.1' }),
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });
  });

  it('handles fetch connections error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should still render the page even with fetch error
    expect(screen.getByText('Sync Status')).toBeInTheDocument();
  });

  it('renders sync status interface when connections exist', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];
    const mockSettings = { filtering: { enabled: true } };

    mockFetch.mockImplementation(async (url, options) => {
      if (url === '/api/get-connections') {
        return {
          ok: true,
          json: async () => ({
            connections: mockConnections,
            masterServerIp: '192.168.1.1',
          }),
        };
      }
      if (url === '/api/get-all-settings') {
        return {
          ok: true,
          json: async () => ({ settings: mockSettings }),
        };
      }
      throw new Error(`Unhandled fetch call: ${url}`);
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('In Sync with Master')).toBeInTheDocument();
    });
  });

  it('handles single connection scenario', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: mockConnections, masterServerIp: "192.168.1.1" }),
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle single connection gracefully
    expect(screen.getByText('Sync Status')).toBeInTheDocument();
  });

  it('handles API errors during sync operations', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockImplementation(async (url, options) => {
        if (url === '/api/get-connections') {
            return {
                ok: true,
                json: async () => ({ connections: mockConnections, masterServerIp: '192.168.1.1' }),
            };
        }
        if (url === '/api/get-all-settings') {
            const body = await JSON.parse(options.body);
            if (body.ip === '192.168.1.1') {
                return {
                    ok: true,
                    json: async () => ({ settings: { filtering: { enabled: true } } })
                };
            }
            return { ok: false, json: async () => ({ message: 'Sync failed' }) };
        }
        throw new Error(`Unhandled fetch call: ${url}`);
    });


    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch settings for/i)).toBeInTheDocument();
    });
  });

  it('fetches and displays master server settings', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];
    const mockSettings = { filtering: { enabled: true } };

    mockFetch.mockImplementation(async (url, options) => {
      if (url === '/api/get-connections') {
        return {
          ok: true,
          json: async () => ({
            connections: mockConnections,
            masterServerIp: '192.168.1.1',
          }),
        };
      }
      if (url === '/api/get-all-settings') {
        return {
          ok: true,
          json: async () => ({ settings: mockSettings }),
        };
      }
      throw new Error(`Unhandled fetch call: ${url}`);
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    expect(screen.getByText('Comparing all servers against master:')).toBeInTheDocument();
  });

  it('displays out of sync status when settings differ', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];
    const masterSettings = { filtering: { enabled: true } };
    const replicaSettings = { filtering: { enabled: false } };

    mockFetch.mockImplementation(async (url, options) => {
      if (url === '/api/get-connections') {
        return {
          ok: true,
          json: async () => ({
            connections: mockConnections,
            masterServerIp: '192.168.1.1',
          }),
        };
      }
      if (url === '/api/get-all-settings') {
        const body = await JSON.parse(options.body);
        if (body.ip === '192.168.1.1') {
          return {
            ok: true,
            json: async () => ({ settings: masterSettings }),
          };
        }
        if (body.ip === '192.168.1.2') {
          return {
            ok: true,
            json: async () => ({ settings: replicaSettings }),
          };
        }
      }
      throw new Error(`Unhandled fetch call: ${url}`);
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Out of Sync')).toBeInTheDocument();
    });

    expect(screen.getByText('filtering')).toBeInTheDocument();
    expect(screen.getByText('Sync')).toBeInTheDocument();
  });

  it('displays in sync status when settings match', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];
    const mockSettings = {
      filtering: { enabled: true },
      querylogConfig: { enabled: false },
    };

    mockFetch.mockImplementation(async (url, options) => {
      if (url === '/api/get-connections') {
        return {
          ok: true,
          json: async () => ({
            connections: mockConnections,
            masterServerIp: '192.168.1.1',
          }),
        };
      }
      if (url === '/api/get-all-settings') {
        return {
          ok: true,
          json: async () => ({ settings: mockSettings }),
        };
      }
      throw new Error(`Unhandled fetch call: ${url}`);
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('In Sync with Master')).toBeInTheDocument();
    });
  });

  it('handles sync button click', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];
    const masterSettings = { filtering: { enabled: true } };
    const replicaSettings = { filtering: { enabled: false } };

    mockFetch.mockImplementation(async (url, options) => {
      if (url === '/api/get-connections') {
        return {
          ok: true,
          json: async () => ({
            connections: mockConnections,
            masterServerIp: '192.168.1.1',
          }),
        };
      }
      if (url === '/api/get-all-settings') {
        const body = await JSON.parse(options.body);
        if (body.ip === '192.168.1.1') {
          return {
            ok: true,
            json: async () => ({ settings: masterSettings }),
          };
        }
        if (body.ip === '192.168.1.2') {
          return {
            ok: true,
            json: async () => ({ settings: replicaSettings }),
          };
        }
      }
      if (url === '/api/sync-category') {
        return {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            }
          })
        };
      }
      throw new Error(`Unhandled fetch call: ${url}`);
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    let syncButton: HTMLElement;
    await waitFor(() => {
      syncButton = screen.getByText('Sync');
      expect(syncButton).toBeInTheDocument();
    });

    fireEvent.click(syncButton!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sync-category', expect.any(Object));
    });
  });

  it('handles master server not configured', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [], masterServerIp: null }),
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Master server or connections not configured.')).toBeInTheDocument();
    });
  });

  it('handles master server not found in connections', async () => {
    const mockConnections = [
      { ip: '192.168.1.2', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connections: mockConnections,
        masterServerIp: '192.168.1.1'
      }),
    });

    await act(async () => {
      render(<SyncStatusPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Configured master server not found in connections list.')).toBeInTheDocument();
    });
  });
});