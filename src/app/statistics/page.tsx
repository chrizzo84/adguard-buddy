"use client";
import NavMenu from "../components/NavMenu";
import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";

// Types
type Connection = {
  ip: string;
  username: string;
  password: string; // encrypted
};

// Based on the openapi.yaml
type TopArrayEntry = { [key: string]: number };

type StatsData = {
  avg_processing_time: number;
  top_queried_domains: TopArrayEntry[];
  top_blocked_domains: TopArrayEntry[];
  top_clients: TopArrayEntry[];
  top_upstreams_avg_time: TopArrayEntry[];
};

export default function StatisticsPage() {
  // State
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDUDY_ENCRYPTION_KEY || "adguard-buddy-key";

  // Effect to load connections from localStorage
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
    if (!selectedConnection) return;

    setIsLoading(true);
    setError(null);
    setStats(null); // Clear old stats

    try {
      let decrypted = "";
      try {
        decrypted = CryptoJS.AES.decrypt(selectedConnection.password, encryptionKey).toString(CryptoJS.enc.Utf8);
      } catch {
        decrypted = "";
      }

      const response = await fetch('/api/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedConnection,
          password: decrypted,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch stats');
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
  }, [selectedConnection, encryptionKey]);

  // Effect for fetching on server selection change
  useEffect(() => {
    if (selectedConnection) {
      fetchStats();
    }
  }, [selectedConnection, fetchStats]);

  // UI Components
  const ServerSelector = () => (
    <div className="mb-4">
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
  );

  const TopListCard = ({ title, data, formatter }: { title: string; data: TopArrayEntry[] | undefined; formatter?: (value: number) => string }) => {
    if (!data || data.length === 0) {
      return (
        <div className="adguard-card">
          <h3 className="card-title mb-4">{title}</h3>
          <p className="text-gray-500">No data available.</p>
        </div>
      );
    }

    return (
      <div className="adguard-card">
        <h3 className="card-title mb-4">{title}</h3>
        <ul className="space-y-2">
          {data.slice(0, 10).map((entry) => {
            const [key, value] = Object.entries(entry)[0];
            const displayValue = formatter ? formatter(value) : value.toLocaleString();
            return (
              <li key={key} className="flex justify-between items-center text-sm">
                <span className="text-gray-300 break-all">{key}</span>
                <span className="font-mono text-primary">{displayValue}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <NavMenu />
      <h1 className="text-3xl font-extrabold mb-4 text-center dashboard-title">Statistics</h1>

      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={fetchStats}
          className="px-4 py-2 font-bold text-primary bg-gray-800 rounded-lg border-neon border hover:bg-gray-700 transition-all duration-300 shadow-neon disabled:opacity-50"
          disabled={isLoading || !selectedConnection}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="adguard-card mb-8">
        <ServerSelector />
      </div>

      {isLoading && <p className="text-center text-primary">Loading statistics...</p>}
      {error && <p className="text-center text-danger">{error}</p>}

      {!isLoading && !error && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <TopListCard title="Top Queried Domains" data={stats.top_queried_domains} />
            <TopListCard title="Top Blocked Domains" data={stats.top_blocked_domains} />
            <TopListCard title="Top Clients" data={stats.top_clients} />
            <TopListCard title="Avg. Upstream Response Time" data={stats.top_upstreams_avg_time} formatter={(v) => `${(v * 1000).toFixed(0)} ms`} />

            <div className="adguard-card">
                <h3 className="card-title mb-4">Avg. Processing Time</h3>
                <p className="text-3xl font-bold text-primary">
                    {(stats.avg_processing_time * 1000).toFixed(2)} ms
                </p>
            </div>
        </div>
      )}

      {!isLoading && !error && !stats && (
        <div className="adguard-card">
          <p className="text-center text-gray-400">
            Select a server and click &apos;Refresh&apos; to load the statistics.
          </p>
        </div>
      )}
    </div>
  );
}
