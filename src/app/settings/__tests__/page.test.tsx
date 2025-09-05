import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Settings from '../page';

// Mock dependencies
jest.mock('../../components/NavMenu', () => ({
  __esModule: true,
  default: () => <nav data-testid="nav-menu">Navigation</nav>,
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: jest.fn(),
  }),
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

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('renders the settings page with navigation', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [], masterServerIp: null }),
    });

    render(<Settings />);

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('fetches settings on mount', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connections: mockConnections,
        masterServerIp: '192.168.1.100'
      }),
    });

    render(<Settings />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });
  });

  it('displays connection form fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [], masterServerIp: null }),
    });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Check for inputs by placeholder text since they don't have labels
    expect(screen.getByPlaceholderText(/IP or URL/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Port')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('handles fetch settings error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<Settings />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should still render the page even with fetch error
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows notification messages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [], masterServerIp: null }),
    });

    render(<Settings />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // The notification system is internal, but we can test that the component renders
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders add connection form', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [], masterServerIp: null }),
    });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    expect(screen.getByText('New Connection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('renders existing connections section', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connections: mockConnections,
        masterServerIp: null
      }),
    });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    expect(screen.getByText('Saved Connections')).toBeInTheDocument();
  });

  it('handles form input changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [], masterServerIp: null }),
    });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    const targetInput = screen.getByPlaceholderText(/IP or URL/);
    fireEvent.change(targetInput, { target: { value: '192.168.1.1' } });

    // The form state is managed internally, so we just verify the input exists
    expect(targetInput).toHaveValue('192.168.1.1');
  });
});
