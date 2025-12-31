"use client";
import PageControls from './PageControls';
import { useState, useEffect, useCallback, useRef } from "react";
import CryptoJS from "crypto-js";
import { Search, Filter, X, Lock, Unlock, Palette } from "lucide-react";

// Types
type Connection = {
  ip?: string;
  url?: string;
  port?: number;
  username: string;
  password: string;
  color?: string;
};

type QueryLogItem = {
  question: {
    name: string;
  };
  client: string;
  time: string;
  status: string;
  reason: string;
  serverIp?: string;
};

type QueryLogResponse = {
  data: QueryLogItem[];
};

type FilterStatus = 'all' | 'processed' | 'filtered';

export default function QueryLogPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [mode, setMode] = useState<'single' | 'combined'>('single');
  const [logs, setLogs] = useState<QueryLogItem[]>([]);
  const [concurrency, setConcurrency] = useState<number>(5);
  const [perServerLimit, setPerServerLimit] = useState<number>(100);
  const [combinedMax, setCombinedMax] = useState<number>(500);
  const [serverCounts, setServerCounts] = useState<Record<string, number>>({});
  const [serverColors, setServerColors] = useState<Record<string, string>>({});
  const [masterServerIp, setMasterServerIp] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [visibleCount, setVisibleCount] = useState<number>(25);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logModalTitle, setLogModalTitle] = useState<string>('');
  const [actionLogs, setActionLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

  const fetchLogs = useCallback(async (isPolling = false) => {
    if (mode === 'single') {
      if (!selectedConnection) return;

      if (!isPolling) setIsLoading(true);
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
        const sid = selectedConnection.url && selectedConnection.url.length > 0 ? selectedConnection.url.replace(/\/$/, '') : `${selectedConnection.ip || ''}${selectedConnection.port ? ':' + selectedConnection.port : ''}`;
        const annotated = (data.data || []).map((item) => ({ ...item, serverIp: sid }));
        setLogs(annotated);
        setServerCounts({ [sid]: annotated.length });
        setLastUpdated(new Date());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message || 'An unknown error occurred.');
        setLogs([]);
        setServerCounts({});
      } finally {
        if (!isPolling) setIsLoading(false);
      }
      return;
    }

    // Combined mode
    if (connections.length === 0) return;

    if (!isPolling) setIsLoading(true);
    setError(null);

    try {
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
        const sid = conn.url && conn.url.length > 0 ? conn.url.replace(/\/$/, '') : `${conn.ip || ''}${conn.port ? ':' + conn.port : ''}`;
        return (data.data || []).map((item) => ({ ...item, serverIp: sid }));
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

      allResults.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      const counts: Record<string, number> = {};
      for (const item of allResults) {
        const id = item.serverIp || item.client || 'Unnamed';
        counts[id] = (counts[id] || 0) + 1;
      }
      setServerCounts(counts);

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
  }, [selectedConnection, filter, encryptionKey, connections, mode, perServerLimit, concurrency, combinedMax]);

  const hexToRgba = (hex: string, alpha = 1) => {
    if (!hex) return undefined;
    const h = hex.replace('#', '');
    const normalized = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('queryLogServerColors');
      if (raw) setServerColors(JSON.parse(raw));
    } catch { }
  }, []);

  const handlePickColor = (ip: string, color: string) => {
    setServerColors(prev => {
      const next = { ...prev, [ip]: color };
      try { localStorage.setItem('queryLogServerColors', JSON.stringify(next)); } catch { }
      return next;
    });

    setConnections(prev => {
      const updated = prev.map(c => c.ip === ip ? { ...c, color } : c);
      (async () => {
        try {
          await fetch('/api/save-connections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connections: updated, masterServerIp }),
          });
        } catch { }
      })();
      return updated;
    });
  };

  const clearAllColors = async () => {
    setServerColors({});
    try { localStorage.removeItem('queryLogServerColors'); } catch { }
    const updated = connections.map(c => {
      const copy = { ...c } as Connection;
      delete copy.color;
      return copy;
    });
    setConnections(updated);
    try {
      await fetch('/api/save-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections: updated, masterServerIp }),
      });
    } catch { }
  };

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

  useEffect(() => {
    if (mode === 'single' && !selectedConnection) return;
    fetchLogs(false);
  }, [selectedConnection, filter, fetchLogs, mode]);

  useEffect(() => {
    if (refreshInterval === 0) return;
    if (mode === 'single' && !selectedConnection) return;

    const intervalId = setInterval(() => {
      if (!isLoading) {
        fetchLogs(true);
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [selectedConnection, filter, isLoading, fetchLogs, refreshInterval, mode]);

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
        setMasterServerIp(data.masterServerIp || null);
        if (conns.length > 0) {
          const first = conns[0];
          setSelectedConnection(first);
          const id = first.url && first.url.length > 0 ? first.url.replace(/\/$/, '') : `${first.ip || 'unknown'}${first.port ? ':' + first.port : ''}`;
          setSelectedId(id);
        }
      } catch (error) {
        const err = error as Error;
        setError(`Error fetching connections: ${err.message}`);
      }
    };
    fetchConnections();
  }, []);

  const LogViewerModal = ({ title, logs, show, onClose }: { title: string, logs: string[], show: boolean, onClose: () => void }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);
    if (!show) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#181A20] border border-[#2A2D35] rounded-xl shadow-2xl w-full max-w-4xl h-[70vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-[#2A2D35]">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-grow p-4 overflow-y-auto font-mono text-sm text-gray-300 bg-[#0F1115]">
            {logs.map((log, index) => (
              <div key={index} className={log.startsWith('Failed') ? 'text-red-400' : ''}>{`> ${log}`}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    );
  };

  const StatusPill = ({ reason }: { reason: string }) => {
    const isBlocked = !reason.startsWith('NotFiltered');

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
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isBlocked
        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
        : 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20'
        }`}>
        {formatReason(reason)}
      </span>
    );
  };

  const filteredLogs = logs.filter(log => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      log.question.name.toLowerCase().includes(searchTermLower) ||
      log.client.toLowerCase().includes(searchTermLower) ||
      (log.serverIp || '').toLowerCase().includes(searchTermLower)
    );
  });

  useEffect(() => {
    const minVisible = pageSize;
    if (visibleCount < minVisible) setVisibleCount(minVisible);
  }, [pageSize, visibleCount]);

  useEffect(() => {
    const onScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const nearBottom = document.body.offsetHeight - 300;
      if (scrollPosition >= nearBottom) {
        setVisibleCount(c => Math.min(filteredLogs.length, c + pageSize));
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pageSize, filteredLogs.length]);

  // Only reset visibleCount when user changes filter/search/mode, NOT on log refreshes
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filter, searchTerm, pageSize, mode]);

  const filterOptions: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Processed', value: 'processed' },
    { label: 'Filtered', value: 'filtered' },
  ];

  return (
    <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <LogViewerModal
        show={showLogModal}
        title={logModalTitle}
        logs={actionLogs}
        onClose={() => setShowLogModal(false)}
      />

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Query Log</h1>
        <p className="text-sm text-gray-500 mt-1">View and manage DNS query history across your servers.</p>
      </header>

      {/* Controls Card */}
      <div className="adguard-card mb-6">
        <PageControls
          mode={mode}
          setMode={setMode}
          connectionsCount={connections.length}
          selectedId={selectedId}
          onSelectId={(id) => {
            setSelectedId(id);
            const conn = connections.find(c => (c.url && c.url.replace(/\/$/, '') === id) || c.ip === id || `${c.ip}${c.port ? ':' + c.port : ''}` === id);
            setSelectedConnection(conn || null);
          }}
          refreshInterval={refreshInterval}
          onSetRefreshInterval={(n) => setRefreshInterval(n)}
          concurrency={concurrency}
          setConcurrency={(n) => setConcurrency(n)}
          perServerLimit={perServerLimit}
          setPerServerLimit={(n) => setPerServerLimit(n)}
          combinedMax={combinedMax}
          setCombinedMax={(n) => setCombinedMax(n)}
          pageSize={pageSize}
          setPageSize={(n) => { setPageSize(n); }}
          connections={connections}
        />
      </div>

      {/* Filters and Search */}
      <div className="adguard-card mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter Buttons */}
            <div className="flex gap-2">
              {filterOptions.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filter === value
                    ? 'text-[var(--primary)] bg-[var(--primary)]/10 border-[var(--primary)]/30'
                    : 'text-gray-400 border-[#2A2D35] hover:border-gray-500'
                    }`}
                >
                  <Filter className="w-4 h-4 inline mr-2" />
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search domain or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                className="pr-4 py-2 w-72 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-300 focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {lastUpdated && (
            <div className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Server Color Legend */}
        {Object.keys(serverCounts).length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#2A2D35]">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Server Colors</span>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {Object.keys(serverCounts).slice(0, 10).map((ip) => {
                const color = serverColors[ip];
                const truncate = (s: string, n = 30) => s.length > n ? `${s.slice(0, n - 3)}...` : s;
                return (
                  <div key={ip} className="flex items-center gap-2">
                    <div className="relative w-6 h-6">
                      <div className="w-6 h-6 rounded-md border border-[#2A2D35]" style={{ backgroundColor: color || 'transparent' }} />
                      <input
                        type="color"
                        value={color || '#000000'}
                        onChange={(e) => handlePickColor(ip, e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label={`Color for ${ip}`}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{truncate(ip)}</span>
                  </div>
                );
              })}
              <button
                onClick={() => clearAllColors()}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-[#0F1115] rounded-md border border-[#2A2D35] hover:border-gray-500 transition-colors"
              >
                Clear colors
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error states */}
      {isLoading && <div className="text-center py-8 text-[var(--primary)]">Loading logs...</div>}
      {error && <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>}

      {/* Query Log Table */}
      {!isLoading && !error && (
        <div className="adguard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wider">
                <tr className="border-b border-[#2A2D35]">
                  <th scope="col" className="px-4 py-3 text-left">Server</th>
                  <th scope="col" className="px-4 py-3 text-left">Timestamp</th>
                  <th scope="col" className="px-4 py-3 text-left">Client</th>
                  <th scope="col" className="px-4 py-3 text-left">Domain</th>
                  <th scope="col" className="px-4 py-3 text-left">Status</th>
                  <th scope="col" className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, visibleCount).map((log, index) => {
                  const isBlocked = !log.reason.startsWith('NotFiltered');
                  const ip = log.serverIp || selectedConnection?.ip || 'unknown';
                  const color = serverColors[ip];
                  const bgColor = color ? hexToRgba(color, 0.06) : undefined;
                  const leftBorder = color ? { borderLeft: `3px solid ${color}` } : {};
                  return (
                    <tr
                      key={index}
                      style={{ backgroundColor: bgColor, ...leftBorder }}
                      className="border-b border-[#2A2D35]/50 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-gray-400 text-xs">{ip.substring(0, 30)}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(log.time).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-gray-300">{log.client}</td>
                      <td className="px-4 py-3 text-gray-300 break-all max-w-xs">{log.question.name}</td>
                      <td className="px-4 py-3">
                        <StatusPill reason={log.reason} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleBlockUnblock(log.question.name, isBlocked ? 'unblock' : 'block')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${isBlocked
                            ? 'text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)]/10'
                            : 'text-red-400 border-red-500/30 hover:bg-red-500/10'
                            }`}
                          title={isBlocked ? "Remove from blocklist" : "Add to blocklist"}
                        >
                          {isBlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-gray-500">No logs found.</div>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between p-4 border-t border-[#2A2D35]">
            <div className="text-xs text-gray-500">
              Showing 1 - {Math.min(visibleCount, filteredLogs.length)} of {filteredLogs.length}
            </div>
            <button
              disabled={visibleCount >= filteredLogs.length}
              onClick={() => setVisibleCount(c => Math.min(filteredLogs.length, c + pageSize))}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${visibleCount >= filteredLogs.length
                ? 'opacity-50 cursor-not-allowed text-gray-500 border-[#2A2D35]'
                : 'text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)]/10'
                }`}
            >
              Load more
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
