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
  // When aggregated from multiple servers we attach the source server IP here
  serverIp?: string;
};

type QueryLogResponse = {
  data: QueryLogItem[];
};

type FilterStatus = 'all' | 'processed' | 'filtered';

export default function QueryLogPage() {
  // State
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [mode, setMode] = useState<'single' | 'combined'>('single');
  const [logs, setLogs] = useState<QueryLogItem[]>([]);
  const [concurrency, setConcurrency] = useState<number>(5); // max concurrent requests in combined mode
  const [perServerLimit, setPerServerLimit] = useState<number>(100);
  const [combinedMax, setCombinedMax] = useState<number>(500);
  const [serverCounts, setServerCounts] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(0);
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
    // If single mode, behave like before and fetch only from selectedConnection
    if (mode === 'single') {
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
            limit: perServerLimit,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch logs');
        }

        const data: QueryLogResponse = await response.json();
        // annotate with server ip for consistency
  const annotated = (data.data || []).map((item) => ({ ...item, serverIp: selectedConnection.ip }));
  setLogs(annotated);
  // update serverCounts for single mode
  setServerCounts({ [selectedConnection.ip]: annotated.length });
        setLastUpdated(new Date());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message || 'An unknown error occurred.');
  setLogs([]);
  setServerCounts({});
      } finally {
        if (!isPolling) {
          setIsLoading(false);
        }
      }

      return;
    }

    // Combined mode: fetch logs from all configured connections and merge
    if (mode === 'combined') {
      if (connections.length === 0) return;

      if (!isPolling) setIsLoading(true);
      setError(null);

      try {
  // Execute fetches in batches to limit concurrency.
        const allResults: QueryLogItem[] = [];
  const batchSize = Math.max(1, concurrency);

        const fetchForConn = async (conn: Connection) => {
          let decrypted = "";
          try {
            decrypted = CryptoJS.AES.decrypt(conn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
          } catch {
            decrypted = "";
          }

          const response = await fetch('/api/query-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...conn,
              password: decrypted,
              response_status: filter,
              limit: perServerLimit,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch logs: ${errorText}`);
          }

          const data: QueryLogResponse = await response.json();
          return (data.data || []).map((item) => ({ ...item, serverIp: conn.ip }));
        };

        for (let i = 0; i < connections.length; i += batchSize) {
          const batch = connections.slice(i, i + batchSize);
          const promises = batch.map(conn => fetchForConn(conn));
          const settled = await Promise.allSettled(promises);

          settled.forEach((res, idx) => {
            const conn = batch[idx];
            if (res.status === 'fulfilled') {
              allResults.push(...res.value);
            } else {
              console.warn(`Failed to fetch logs from ${conn.ip}: ${res.reason}`);
            }
          });
        }

        // sort by time descending so newest appear first
        allResults.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

        // compute per-server counts
        const counts: Record<string, number> = {};
        for (const item of allResults) {
          const ip = item.serverIp || 'unknown';
          counts[ip] = (counts[ip] || 0) + 1;
        }
        setServerCounts(counts);

        // apply a combined maximum cap to avoid huge lists in the UI
        const truncated = (combinedMax > 0) ? allResults.slice(0, combinedMax) : allResults;
        setLogs(truncated);
        setLastUpdated(new Date());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message || 'An unknown error occurred while fetching combined logs.');
  setLogs([]);
  setServerCounts({});
      } finally {
        if (!isPolling) setIsLoading(false);
      }
    }
  }, [selectedConnection, filter, encryptionKey, connections, mode, perServerLimit, concurrency, combinedMax]);

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
  // In single mode we need a selected connection. In combined mode we fetch regardless.
  if (mode === 'single' && !selectedConnection) return;
  fetchLogs(false);
  }, [selectedConnection, filter, fetchLogs, mode]);

  // Effect for polling
  useEffect(() => {
    // Don't poll if interval is off. In single mode require a selected connection.
    if (refreshInterval === 0) return;
    if (mode === 'single' && !selectedConnection) return;

    const intervalId = setInterval(() => {
      if (!isLoading) {
        fetchLogs(true);
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [selectedConnection, filter, isLoading, fetchLogs, refreshInterval, mode]);

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

    const ViewModeSwitcher = () => (
      <div className="relative flex items-center justify-center bg-gray-900 p-1 rounded-full border border-white/10">
        <span
          className="absolute top-1 left-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-[var(--primary)] transition-transform duration-300 ease-in-out"
          style={{ transform: mode === 'single' ? 'translateX(0%)' : 'translateX(100%)' }}
        />
        <button
          onClick={() => setMode('single')}
          className="relative z-10 w-1/2 py-2 text-sm font-bold transition-colors duration-300 rounded-full"
        >
          <span className={mode === 'single' ? 'text-gray-900' : 'text-gray-300'}>Single</span>
        </button>
        <button
          onClick={() => setMode('combined')}
          className="relative z-10 w-1/2 py-2 text-sm font-bold transition-colors duration-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={connections.length < 2}
        >
          <span className={mode === 'combined' ? 'text-gray-900' : 'text-gray-300'}>Combined</span>
        </button>
      </div>
    );

    // We render both single and combined control sets but hide the inactive one
    // using invisible + pointer-events-none so the overall card height stays stable
    // when switching modes. Combined controls are arranged inline with min/max
    // widths so they fit nicely on one row on desktop.
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          {/* Three equal columns: Switch | Server (or placeholder) | Refresh */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-400 mb-2 invisible">Mode</label>
            <div className="w-full">
              <ViewModeSwitcher />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {mode === 'single' ? (
              <div>
                <label htmlFor="server-select" className="block text-sm font-medium text-gray-400 mb-2">Server</label>
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
                    <option key={conn.ip} value={conn.ip}>{conn.ip} ({conn.username})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="pt-6 text-sm text-gray-400">Combined: all servers</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <label htmlFor="interval-select" className="block text-sm font-medium text-gray-400 mb-2">Refresh Interval</label>
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

        {/* Controls row: render only the active set so single controls stay near the top */}
        <div className="w-full">
          {mode === 'combined' && (
            <div>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-[160px] max-w-[320px]">
                <label htmlFor="concurrency-select" className="block text-sm font-medium text-gray-400 mb-2">Combined concurrency</label>
                  <select id="concurrency-select" value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon">
                  {[1,2,3,5,8,10].map(n => (
                    <option key={n} value={n}>{n} concurrent</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[140px] max-w-[240px]">
                <label className="text-sm font-medium text-gray-400 mb-2">Per-server limit</label>
                <select value={perServerLimit} onChange={(e) => setPerServerLimit(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                  {[25,50,100,200].map(n => <option key={n} value={n}>{n} per server</option>)}
                </select>
              </div>

              <div className="flex-1 min-w-[140px] max-w-[240px]">
                <label className="text-sm font-medium text-gray-400 mb-2">Combined max</label>
                <select value={combinedMax} onChange={(e) => setCombinedMax(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                  {[100,250,500,1000].map(n => <option key={n} value={n}>{n} total</option>)}
                </select>
              </div>

              <div className="flex-1 min-w-[120px] max-w-[160px]">
                <label className="text-sm font-medium text-gray-400 mb-2">Page size</label>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                  {[10,25,50].map(n => <option key={n} value={n}>{n} rows</option>)}
                </select>
              </div>
            </div>
          </div>
      )}

          {mode === 'single' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2">Per-server limit</label>
                <select value={perServerLimit} onChange={(e) => setPerServerLimit(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                  {[25,50,100,200].map(n => <option key={n} value={n}>{n} per server</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400 mb-2">Page size</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                  {[10,25,50].map(n => <option key={n} value={n}>{n} rows</option>)}
                </select>
              </div>
            </div>
          )}
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
        <th scope="col" className="px-6 py-3">Server IP</th>
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
          <td className="px-6 py-4 font-mono">{log.serverIp || selectedConnection?.ip || '-'}</td>
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
  log.client.toLowerCase().includes(searchTermLower) ||
  (log.serverIp || '').toLowerCase().includes(searchTermLower)
    );
  });

  // Ensure currentPage is within bounds when filteredLogs or pageSize change
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredLogs.length / pageSize) - 1);
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [filteredLogs.length, pageSize, currentPage]);

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
        {/* Server counts display */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(serverCounts).length === 0 ? (
              <span className="text-xs text-gray-500">No per-server stats</span>
            ) : (
              Object.entries(serverCounts).map(([ip, count]) => (
                <div key={ip} className="px-3 py-1 rounded-md bg-gray-800 text-xs text-gray-300 border border-gray-700">
                  {ip}: {count}
                </div>
              ))
            )}
          </div>
        </div>
        {isLoading && <p className="text-center text-primary">Loading logs...</p>}
        {error && <p className="text-center text-danger">{error}</p>}
        {!isLoading && !error && (
          <>
            <LogTable logsToShow={filteredLogs.slice(currentPage * pageSize, (currentPage + 1) * pageSize)} />

            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-gray-400">Showing {(currentPage * pageSize) + 1} - {Math.min((currentPage + 1) * pageSize, filteredLogs.length)} of {filteredLogs.length}</div>
              <div className="flex gap-2">
                <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => Math.max(0, p - 1))} className={`px-3 py-1 rounded-md ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-800'}`}>Prev</button>
                <button disabled={(currentPage + 1) * pageSize >= filteredLogs.length} onClick={() => setCurrentPage(p => p + 1)} className={`px-3 py-1 rounded-md ${((currentPage + 1) * pageSize >= filteredLogs.length) ? 'opacity-50 cursor-not-allowed' : 'bg-gray-800'}`}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
