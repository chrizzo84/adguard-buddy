"use client";
import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";
import { RefreshCw, Server, Users } from "lucide-react";

// Types
type Connection = {
  ip: string;
  username: string;
  password: string;
  url?: string;
  port?: number;
  allowInsecure?: boolean;
};

type TopArrayEntry = { [key: string]: number };

type StatsData = {
  avg_processing_time: number;
  dns_queries?: number;
  top_queried_domains: TopArrayEntry[];
  top_blocked_domains: TopArrayEntry[];
  top_clients: TopArrayEntry[];
  top_upstreams_avg_time: TopArrayEntry[];
};

type ViewMode = 'single' | 'combined';

export default function StatisticsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

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

  const fetchStats = useCallback(async () => {
    if (viewMode === 'single' && !selectedConnection) return;

    setIsLoading(true);
    setError(null);
    setStats(null);

    try {
      let response;
      if (viewMode === 'combined') {
        response = await fetch('/api/statistics/combined');
      } else {
        let decrypted = "";
        try {
          decrypted = CryptoJS.AES.decrypt(selectedConnection!.password, encryptionKey).toString(CryptoJS.enc.Utf8);
        } catch {
          decrypted = "";
        }
        response = await fetch('/api/statistics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...selectedConnection,
            password: decrypted,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch stats (mode: ${viewMode})`);
      }

      const data: StatsData = await response.json();
      setStats(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'An unknown error occurred.');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedConnection, encryptionKey, viewMode]);

  useEffect(() => {
    if (viewMode === 'single') {
      if (selectedConnection) {
        fetchStats();
      }
    } else {
      fetchStats();
    }
  }, [selectedConnection, viewMode, fetchStats]);

  const TopListCard = ({ title, data, formatter, icon }: { title: string; data: TopArrayEntry[] | undefined; formatter?: (value: number) => string; icon?: React.ReactNode }) => {
    if (!data || data.length === 0) {
      return (
        <div className="adguard-card">
          <h3 className="card-title">{icon}{title}</h3>
          <p className="text-gray-500 text-sm">No data available.</p>
        </div>
      );
    }

    return (
      <div className="adguard-card">
        <h3 className="card-title">{icon}{title}</h3>
        <ul className="space-y-2">
          {data.slice(0, 10).map((entry, index) => {
            const [key, value] = Object.entries(entry)[0];
            const displayValue = formatter ? formatter(value) : value.toLocaleString();
            return (
              <li key={`${key}-${index}`} className="flex justify-between items-center text-sm">
                <span className="text-gray-400 break-all truncate mr-4">{key}</span>
                <span className="font-mono text-[var(--primary)] flex-shrink-0">{displayValue}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Statistics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {viewMode === 'combined'
              ? `Viewing combined statistics for ${connections.length} servers`
              : 'View detailed statistics for individual servers'}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={isLoading || (viewMode === 'single' && !selectedConnection)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#181A20] border border-[#2A2D35] text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      {/* Controls */}
      <div className="adguard-card mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* View Mode Toggle */}
          <div className="relative flex items-center bg-[#0F1115] p-1 rounded-full border border-[#2A2D35]">
            <button
              onClick={() => setViewMode('single')}
              className={`relative z-10 px-4 py-2 text-sm font-medium rounded-full transition-all ${viewMode === 'single'
                  ? 'text-black bg-[var(--primary)]'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              <Server className="w-4 h-4 inline mr-2" />
              Single Server
            </button>
            <button
              onClick={() => setViewMode('combined')}
              disabled={connections.length < 2}
              className={`relative z-10 px-4 py-2 text-sm font-medium rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${viewMode === 'combined'
                  ? 'text-black bg-[var(--primary)]'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Combined
            </button>
          </div>

          {/* Server Selector (only for single mode) */}
          {viewMode === 'single' && (
            <div className="flex-grow">
              <select
                value={selectedConnection ? (selectedConnection.url ? selectedConnection.url.replace(/\/$/, '') : `${selectedConnection.ip}:${selectedConnection.port ?? 80}`) : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const conn = connections.find(c => (c.url && c.url.replace(/\/$/, '') === val) || (`${c.ip}:${c.port ?? 80}` === val));
                  setSelectedConnection(conn || null);
                }}
                className="w-full md:w-auto px-4 py-2.5 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-300 focus:outline-none focus:border-[var(--primary)]"
                disabled={connections.length === 0}
              >
                {connections.map(conn => {
                  const id = conn.url ? conn.url.replace(/\/$/, '') : `${conn.ip}:${conn.port ?? 80}`;
                  return (
                    <option key={id} value={id}>
                      {conn.url ? `${conn.url} (${conn.username || ''})` : `${conn.ip}:${conn.port ?? 80} (${conn.username || ''})`}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12 text-[var(--primary)]">Loading statistics...</div>
      )}

      {/* Statistics Grid */}
      {!isLoading && !error && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total DNS Queries (only for combined mode) */}
          {viewMode === 'combined' && stats.dns_queries != null && (
            <div className="adguard-card">
              <h3 className="card-title">Total DNS Queries</h3>
              <p className="text-4xl font-bold text-[var(--primary)] font-mono">
                {stats.dns_queries.toLocaleString()}
              </p>
            </div>
          )}

          {/* Avg Processing Time */}
          <div className="adguard-card">
            <h3 className="card-title">Avg. Processing Time</h3>
            <p className="text-4xl font-bold text-[var(--primary)] font-mono">
              {(stats.avg_processing_time * 1000).toFixed(2)} <span className="text-lg text-gray-500">ms</span>
            </p>
          </div>

          <TopListCard title="Top Queried Domains" data={stats.top_queried_domains} />
          <TopListCard title="Top Blocked Domains" data={stats.top_blocked_domains} />
          <TopListCard title="Top Clients" data={stats.top_clients} />
          <TopListCard
            title="Avg. Upstream Response Time"
            data={stats.top_upstreams_avg_time}
            formatter={(v) => `${(v * 1000).toFixed(0)} ms`}
          />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !stats && (
        <div className="adguard-card text-center py-8">
          <p className="text-gray-500">
            {viewMode === 'single'
              ? "Select a server and click 'Refresh' to load the statistics."
              : "Click 'Refresh' to load combined statistics for all servers."
            }
          </p>
        </div>
      )}
    </main>
  );
}
