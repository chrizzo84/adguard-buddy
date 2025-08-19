"use client";
import NavMenu from "../components/NavMenu";
import { useState, useEffect, useCallback, useRef } from "react";
import CryptoJS from "crypto-js";

// Types
type Connection = {
  ip: string;
  username: string;
  password: string; // encrypted
};

type QueryLogItem = {
  question: {
    name: string;
  };
  client: string;
  time: string;
  status: string;
  reason: string;
};

type QueryLogResponse = {
  data: QueryLogItem[];
};

type FilterStatus = 'all' | 'processed' | 'filtered';

export default function QueryLogPage() {
  // State
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [logs, setLogs] = useState<QueryLogItem[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000); // 5 seconds default, 0 for off
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logModalTitle, setLogModalTitle] = useState<string>('');
  const [actionLogs, setActionLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

  const fetchLogs = useCallback(async (isPolling = false) => {
    if (!selectedConnection) return;

    if (!isPolling) {
      setIsLoading(true);
    }
    setError(null);

    try {
      let decrypted = "";
      try {
        decrypted = CryptoJS.AES.decrypt(selectedConnection.password, encryptionKey).toString(CryptoJS.enc.Utf8);
      } catch {
        decrypted = "";
      }

      const response = await fetch('/api/query-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedConnection,
          password: decrypted,
          response_status: filter,
          limit: 100,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch logs');
      }

      const data: QueryLogResponse = await response.json();
      setLogs(data.data || []);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'An unknown error occurred.');
      setLogs([]);
    } finally {
      if (!isPolling) {
        setIsLoading(false);
      }
    }
  }, [selectedConnection, filter, encryptionKey]);

  const handleBlockUnblock = async (domain: string, action: 'block' | 'unblock') => {
    setShowLogModal(true);
    setLogModalTitle(`Running ${action} on ${domain}...`);
    setActionLogs([]);

    const response = await fetch('/api/set-filtering-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, action }),
    });

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            setLogModalTitle(prev => prev.replace('Running', 'Finished'));
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                try {
                    const data = JSON.parse(jsonStr);
                    setActionLogs(prev => [...prev, data.message]);
                } catch {
                    console.error("Failed to parse log line:", jsonStr);
                }
            }
        }
    }
  };

  // Effect for fetching on dependency change
  useEffect(() => {
    if (selectedConnection) {
      fetchLogs(false);
    }
  }, [selectedConnection, filter, fetchLogs]);

  // Effect for polling
  useEffect(() => {
    if (!selectedConnection || refreshInterval === 0) {
      return; // Don't poll if no server selected or interval is off
    }

    const intervalId = setInterval(() => {
      if (!isLoading) {
        fetchLogs(true);
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [selectedConnection, filter, isLoading, fetchLogs, refreshInterval]);

  // Effect to load connections from server
  useEffect(() => {
    const fetchConnections = async () => {
        try {
          const response = await fetch('/api/get-connections');
          if (!response.ok) {
            throw new Error('Failed to fetch connections.');
          }
          const data = await response.json();
          const conns = data.connections || [];
          setConnections(conns);
          if (conns.length > 0) {
            setSelectedConnection(conns[0]);
          }
        } catch (error) {
          const err = error as Error;
          setError(`Error fetching connections: ${err.message}`);
        }
    };
    fetchConnections();
  }, []);

  // UI Components
  const LogViewerModal = ({ title, logs, show, onClose }: { title: string, logs: string[], show: boolean, onClose: () => void }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);
    if (!show) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-primary-dark rounded-lg shadow-lg w-full max-w-4xl h-[70vh] flex flex-col p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-primary">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-2xl">&times;</button>
          </div>
          <div className="bg-black flex-grow rounded-md p-4 overflow-y-auto font-mono text-sm text-gray-300">
            {logs.map((log, index) => (
              <div key={index} className={log.startsWith('Failed') ? 'text-danger' : ''}>{`> ${log}`}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    );
  };

  const PageControls = () => {
    const intervalOptions = [
      { label: '2 Seconds', value: 2000 },
      { label: '5 Seconds', value: 5000 },
      { label: '10 Seconds', value: 10000 },
      { label: '30 Seconds', value: 30000 },
      { label: 'Off', value: 0 },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="server-select" className="block text-sm font-medium text-gray-400 mb-2">
                    Server
                </label>
                <select
                    id="server-select"
                    value={selectedConnection?.ip || ''}
                    onChange={(e) => {
                        const conn = connections.find(c => c.ip === e.target.value);
                        setSelectedConnection(conn || null);
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon"
                    disabled={connections.length === 0}
                >
                    {connections.map(conn => (
                        <option key={conn.ip} value={conn.ip}>
                            {conn.ip} ({conn.username})
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="interval-select" className="block text-sm font-medium text-gray-400 mb-2">
                    Refresh Interval
                </label>
                <select
                    id="interval-select"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon"
                >
                    {intervalOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
  };

  const FilterControls = () => {
    const filterOptions: { label: string; value: FilterStatus }[] = [
        { label: 'All', value: 'all' },
        { label: 'Processed', value: 'processed' },
        { label: 'Filtered', value: 'filtered' },
    ];
    return (
      <div className="flex justify-center gap-4">
        {filterOptions.map(({label, value}) => (
            <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-2 font-bold rounded-lg border transition-all duration-300
                    ${filter === value ? 'shadow-neon border-neon text-primary' : 'border-gray-600 text-gray-400'}`}
            >
                {label}
            </button>
        ))}
      </div>
    );
  };

  const StatusPill = ({ reason }: { reason: string }) => {
    const isBlocked = !reason.startsWith('NotFiltered');

    const pillClass = isBlocked
      ? 'bg-danger-dark text-danger'
      : 'bg-primary-dark text-primary';

    const formatReason = (r: string): string => {
        switch (r) {
            case 'NotFilteredNotFound': return 'Processed';
            case 'NotFilteredWhiteList': return 'Whitelisted';
            case 'FilteredBlackList': return 'Blocked (Blocklist)';
            case 'FilteredSafeBrowsing': return 'Blocked (Safe Browsing)';
            case 'FilteredParental': return 'Blocked (Parental)';
            case 'FilteredInvalid': return 'Blocked (Invalid)';
            case 'FilteredSafeSearch': return 'Blocked (Safe Search)';
            case 'FilteredBlockedService': return 'Blocked (Service)';
            case 'Rewrite':
            case 'RewriteEtcHosts':
            case 'RewriteRule':
                return 'Rewrite';
            default:
                return r.replace(/([A-Z])/g, ' $1').trim();
        }
    }

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${pillClass}`}>
        {formatReason(reason)}
      </span>
    );
  };

  const LogTable = ({ logsToShow }: { logsToShow: QueryLogItem[] }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                    <th scope="col" className="px-6 py-3">Timestamp</th>
                    <th scope="col" className="px-6 py-3">Client</th>
                    <th scope="col" className="px-6 py-3">Domain</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3">Actions</th>
                </tr>
            </thead>
            <tbody>
                {logsToShow.map((log, index) => {
                    const isBlocked = !log.reason.startsWith('NotFiltered');
                    return (
                        <tr key={index} className="border-b border-gray-700 hover:bg-gray-800/50">
                            <td className="px-6 py-4">{new Date(log.time).toLocaleString()}</td>
                            <td className="px-6 py-4 font-mono">{log.client}</td>
                            <td className="px-6 py-4 break-all">{log.question.name}</td>
                            <td className="px-6 py-4">
                                <StatusPill reason={log.reason} />
                            </td>
                            <td className="px-6 py-4">
                                {isBlocked ? (
                                    <button onClick={() => handleBlockUnblock(log.question.name, 'unblock')} className="px-3 py-1 text-xs text-primary border border-neon rounded-md hover:bg-gray-700" title="Remove this domain from the blocklist">Unblock</button>
                                ) : (
                                    <button onClick={() => handleBlockUnblock(log.question.name, 'block')} className="px-3 py-1 text-xs text-danger border border-danger rounded-md hover:bg-gray-700" title="Add this domain to the blocklist">Block</button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {logsToShow.length === 0 && !isLoading && (
            <p className="text-center py-8 text-gray-500">No logs found.</p>
        )}
    </div>
  );

  const filteredLogs = logs.filter(log => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
        log.question.name.toLowerCase().includes(searchTermLower) ||
        log.client.toLowerCase().includes(searchTermLower)
    );
  });

  return (
    <div className="max-w-7xl mx-auto p-8">
      <NavMenu />
      <LogViewerModal
        show={showLogModal}
        title={logModalTitle}
        logs={actionLogs}
        onClose={() => setShowLogModal(false)}
      />
      <h1 className="text-3xl font-extrabold mb-8 text-center dashboard-title">Query Log</h1>

      <div className="adguard-card mb-8">
        <PageControls />
      </div>

      <div className="adguard-card">
        <div className="flex justify-between items-center mb-8 gap-4">
          <div className="flex-1">
            <FilterControls />
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search domain or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon"
            />
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-500 text-right">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
        {isLoading && <p className="text-center text-primary">Loading logs...</p>}
        {error && <p className="text-center text-danger">{error}</p>}
        {!isLoading && !error && <LogTable logsToShow={filteredLogs} />}
      </div>
    </div>
  );
}
