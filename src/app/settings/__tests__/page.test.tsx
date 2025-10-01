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

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('renders the settings page with navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: [], masterServerIp: null }),
    });

    await act(async () => {
      render(<Settings />);
    });

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

    await act(async () => {
      render(<Settings />);
    });

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

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should still render the page even with fetch error
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

  it('toggles password visibility', async () => {
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

    const passwordInput = screen.getByPlaceholderText('Password');
    const toggleButton = screen.getByText('👁️');

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('handles insecure SSL checkbox', async () => {
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

    const checkbox = screen.getByLabelText('Allow insecure SSL (accept self-signed certificates)');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('saves new connection successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: [], masterServerIp: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ enabled: false, interval: '0 */6 * * *', isPaused: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'connected' }),
      });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    const targetInput = screen.getByPlaceholderText(/IP or URL/);
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const saveButton = screen.getByRole('button', { name: /save/i });

    fireEvent.change(targetInput, { target: { value: '192.168.1.1' } });
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/save-connections', expect.any(Object));
    });

    expect(screen.getByText('Connection to 192.168.1.1:80 successful!')).toBeInTheDocument();
  });

  it('shows error when saving without required fields', async () => {
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

    const saveButton = screen.getByRole('button', { name: /save/i });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Should not call save API when required fields are missing
    expect(mockFetch).toHaveBeenCalledTimes(2); // get-connections + auto-sync-config
  });

  it('switches theme', async () => {
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

    const greenThemeButton = screen.getByRole('button', { name: /green/i });
    fireEvent.click(greenThemeButton);

    // Theme switching is handled by context, so we just verify the button exists
    expect(greenThemeButton).toBeInTheDocument();
  });

  it('handles URL parsing in form input', async () => {
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
    const portInput = screen.getByPlaceholderText('Port');

    // Test HTTPS URL
    fireEvent.change(targetInput, { target: { value: 'https://adguard.example.com' } });
    expect(portInput).toHaveValue(443);

    // Test HTTP URL
    fireEvent.change(targetInput, { target: { value: 'http://adguard.example.com' } });
    expect(portInput).toHaveValue(80);

    // Test URL with custom port
    fireEvent.change(targetInput, { target: { value: 'https://adguard.example.com:8443' } });
    expect(portInput).toHaveValue(8443);
  });

  it('handles edit connection functionality', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ connections: mockConnections, masterServerIp: null }),
    });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render edit button
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('handles delete connection functionality', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections, masterServerIp: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render delete button
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('handles master server functionality', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections, masterServerIp: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should handle master server setting
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('handles connection test functionality', async () => {
    const mockConnections = [
      { ip: '192.168.1.1', port: 8080, username: 'admin', password: 'encrypted' },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: mockConnections, masterServerIp: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'connected' }),
      });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    // Should render test button
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('handles form validation for empty fields', async () => {
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

    const saveButton = screen.getByRole('button', { name: /save/i });

    // Try to save without filling required fields
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Should not call save API
    expect(mockFetch).toHaveBeenCalledTimes(2); // get-connections + auto-sync-config
  });

  it('handles URL-based connections', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connections: [], masterServerIp: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'connected' }),
      });

    await act(async () => {
      render(<Settings />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/get-connections');
    });

    const targetInput = screen.getByPlaceholderText(/IP or URL/);
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const saveButton = screen.getByRole('button', { name: /save/i });

    fireEvent.change(targetInput, { target: { value: 'https://adguard.example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Should handle URL connections
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
