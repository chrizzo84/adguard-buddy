import { render, screen, fireEvent } from '@testing-library/react';
import PageControls from '../PageControls';

const mockProps = {
  mode: 'single' as const,
  setMode: jest.fn(),
  connectionsCount: 2,
  selectedId: 'server1',
  onSelectId: jest.fn(),
  refreshInterval: 5000,
  onSetRefreshInterval: jest.fn(),
  concurrency: 3,
  setConcurrency: jest.fn(),
  perServerLimit: 50,
  setPerServerLimit: jest.fn(),
  combinedMax: 250,
  setCombinedMax: jest.fn(),
  pageSize: 25,
  setPageSize: jest.fn(),
  connections: [
    { ip: '192.168.1.1', port: 8080, username: 'admin' },
    { url: 'http://server2.com', username: 'user' },
  ],
};

describe('PageControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders mode toggle buttons', () => {
    render(<PageControls {...mockProps} />);

    expect(screen.getByText('Single')).toBeInTheDocument();
    expect(screen.getByText('Combined')).toBeInTheDocument();
  });

  it('calls setMode when clicking mode buttons', () => {
    render(<PageControls {...mockProps} />);

    fireEvent.click(screen.getByText('Combined'));
    expect(mockProps.setMode).toHaveBeenCalledWith('combined');

    fireEvent.click(screen.getByText('Single'));
    expect(mockProps.setMode).toHaveBeenCalledWith('single');
  });

  it('disables combined mode when connectionsCount < 2', () => {
    render(<PageControls {...mockProps} connectionsCount={1} />);

    const combinedButton = screen.getByText('Combined').closest('button');
    expect(combinedButton).toBeDisabled();
  });

  it('renders server select in single mode', () => {
    render(<PageControls {...mockProps} />);

    expect(screen.getByLabelText('Server')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/192\.168\.1\.1:8080/)).toBeInTheDocument();
  });

  it('renders server count display in combined mode', () => {
    render(<PageControls {...mockProps} mode="combined" />);

    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.getByText('2 servers')).toBeInTheDocument();
  });

  it('calls onSelectId when server selection changes', () => {
    render(<PageControls {...mockProps} />);

    const select = screen.getByLabelText('Server');
    fireEvent.change(select, { target: { value: 'http://server2.com' } });

    expect(mockProps.onSelectId).toHaveBeenCalledWith('http://server2.com');
  });

  it('renders refresh interval select with correct options', () => {
    render(<PageControls {...mockProps} />);

    const select = screen.getByLabelText('Refresh Interval');
    expect(select).toHaveValue('5000');

    expect(screen.getByText('2 Seconds')).toBeInTheDocument();
    expect(screen.getByText('5 Seconds')).toBeInTheDocument();
    expect(screen.getByText('10 Seconds')).toBeInTheDocument();
    expect(screen.getByText('30 Seconds')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('calls onSetRefreshInterval when refresh interval changes', () => {
    render(<PageControls {...mockProps} />);

    const select = screen.getByLabelText('Refresh Interval');
    fireEvent.change(select, { target: { value: '10000' } });

    expect(mockProps.onSetRefreshInterval).toHaveBeenCalledWith(10000);
  });

  it('renders combined mode controls when mode is combined', () => {
    render(<PageControls {...mockProps} mode="combined" />);

    expect(screen.getByLabelText('Combined concurrency')).toBeInTheDocument();
    expect(screen.getByText('Per-server limit')).toBeInTheDocument();
    expect(screen.getByText('Combined max')).toBeInTheDocument();
  });

  it('renders single mode controls when mode is single', () => {
    render(<PageControls {...mockProps} mode="single" />);

    expect(screen.getByText('Per-server limit')).toBeInTheDocument();
    expect(screen.queryByLabelText('Combined concurrency')).not.toBeInTheDocument();
  });

  it('calls setConcurrency when concurrency changes', () => {
    render(<PageControls {...mockProps} mode="combined" />);

    const select = screen.getByLabelText('Combined concurrency');
    fireEvent.change(select, { target: { value: '5' } });

    expect(mockProps.setConcurrency).toHaveBeenCalledWith(5);
  });

  it('calls setPerServerLimit when per server limit changes', () => {
    render(<PageControls {...mockProps} mode="single" />);

    const select = screen.getByDisplayValue('50 per server');
    fireEvent.change(select, { target: { value: '100' } });

    expect(mockProps.setPerServerLimit).toHaveBeenCalledWith(100);
  });

  it('calls setCombinedMax when combined max changes', () => {
    render(<PageControls {...mockProps} mode="combined" />);

    const select = screen.getByDisplayValue('250 total');
    fireEvent.change(select, { target: { value: '500' } });

    expect(mockProps.setCombinedMax).toHaveBeenCalledWith(500);
  });

  it('disables server select when connectionsCount is 0', () => {
    render(<PageControls {...mockProps} connectionsCount={0} />);

    const select = screen.getByLabelText('Server');
    expect(select).toBeDisabled();
  });

  it('displays connection details correctly in server options', () => {
    render(<PageControls {...mockProps} />);

    // Should show IP:port format for first connection
    expect(screen.getByText(/192\.168\.1\.1:8080/)).toBeInTheDocument();

    // Should show URL for second connection
    expect(screen.getByText(/http:\/\/server2\.com/)).toBeInTheDocument();
  });

  it('handles connections with missing data gracefully', () => {
    const propsWithIncompleteData = {
      ...mockProps,
      connections: [
        { username: 'admin' }, // Missing IP and URL
        { ip: '192.168.1.2', username: 'user2' }, // Missing port
      ],
    };

    render(<PageControls {...propsWithIncompleteData} />);

    expect(screen.getByText('admin (admin)')).toBeInTheDocument();
    expect(screen.getByText(/192\.168\.1\.2/)).toBeInTheDocument();
  });
});
