import { screen, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from '../page';
import { useConnections } from '../../contexts/ConnectionsContext';
import { connection, mockConnectionsValue, renderWithProviders } from '../../../test-utils';

jest.mock('../../contexts/ConnectionsContext', () => ({
  ...jest.requireActual('../../contexts/ConnectionsContext'),
  useConnections: jest.fn(),
}));

const mockUseConnections = useConnections as jest.MockedFunction<typeof useConnections>;

const STATUS = {
  version: 'v0.107.52',
  language: 'en',
  dns_port: 53,
  http_port: 3000,
  running: true,
  protection_enabled: true,
  dhcp_available: false,
  dns_addresses: ['192.168.1.1'],
};

const STATS = {
  num_dns_queries: 1000,
  num_blocked_filtering: 250,
  avg_processing_time: 0.02,
  dns_queries: [10, 20, 30, 40],
};

function mockCheckResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'connected',
      response: JSON.stringify(STATUS),
      code: 200,
      stats: STATS,
      ...overrides,
    }),
  } as unknown as Response;
}

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConnections.mockReturnValue(mockConnectionsValue());
    global.fetch = jest.fn().mockResolvedValue(mockCheckResponse());
  });

  it('addresses servers by connection id and never sends credentials', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ connectionId: '192.168.1.1:80' });
    expect(init.body).not.toContain('password');
  });

  it('summarises the fleet in the KPI row', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
    }));
    renderWithProviders(<Dashboard />);

    await waitFor(() => expect(screen.getByText('2/2')).toBeInTheDocument());
    expect(screen.getByText('2,000')).toBeInTheDocument(); // queries across both
    expect(screen.getByText('500')).toBeInTheDocument();   // blocked across both
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('renders one row per server with its figures', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.getByText('192.168.1.1:80')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('labels the trend as 24h for hourly statistics', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockCheckResponse({
      stats: { ...STATS, time_units: 'hours' },
    }));
    renderWithProviders(<Dashboard />);

    expect(await screen.findByLabelText('Query trend for 192.168.1.1:80, last 24 hours')).toBeInTheDocument();
    expect(screen.getByText('24h')).toBeInTheDocument();
  });

  it('shows the last 7 days instead of 24 buckets for daily statistics', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockCheckResponse({
      stats: { ...STATS, time_units: 'days', dns_queries: Array.from({ length: 90 }, (_, i) => i) },
    }));
    renderWithProviders(<Dashboard />);

    expect(await screen.findByLabelText('Query trend for 192.168.1.1:80, last 7 days')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
  });

  it('warns when a server has protection disabled', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockCheckResponse({
      response: JSON.stringify({ ...STATUS, protection_enabled: false }),
    }));

    renderWithProviders(<Dashboard />);

    await waitFor(() => expect(screen.getByText('Protection is off')).toBeInTheDocument());
  });

  it('toggles protection for a single server by id', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls
        .find(([url]) => String(url).includes('/api/adguard-control'));
      expect(JSON.parse(call[1].body)).toEqual({
        connectionId: '192.168.1.1:80',
        protection_enabled: false,
      });
    });
  });

  it('toggles every server when Disable all is used', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
    }));
    renderWithProviders(<Dashboard />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Disable all/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Disable all/ }));

    await waitFor(() => {
      const controlCalls = (global.fetch as jest.Mock).mock.calls
        .filter(([url]) => String(url).includes('/api/adguard-control'));
      expect(controlCalls).toHaveLength(2);
    });
  });

  it('expands a row to show version and ports', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => expect(screen.getByLabelText('Expand 192.168.1.1:80')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Expand 192.168.1.1:80'));

    expect(screen.getByText('v0.107.52')).toBeInTheDocument();
    expect(screen.getByText('53')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });

  it('marks an unreachable server as an error and shows the message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: 'Failed to reach AdGuard Home' }),
    } as unknown as Response);

    renderWithProviders(<Dashboard />);

    await waitFor(() => expect(screen.getByText('Error')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Expand 192.168.1.1:80'));
    expect(screen.getByText('Failed to reach AdGuard Home')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is configured', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [], selectedId: null, selected: null,
    }));

    renderWithProviders(<Dashboard />);

    await waitFor(() => expect(screen.getByText('No connections configured')).toBeInTheDocument());
  });

  it('refetches on demand', async () => {
    renderWithProviders(<Dashboard />);
    // The refresh button stays disabled until the first load settles.
    await waitFor(() => expect(screen.getByRole('button', { name: /Refresh/ })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});
