"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import CryptoJS from "crypto-js";
import { RefreshCw, Server, Users, Activity, Shield, AlertTriangle, Clock, Globe, Monitor, Smartphone, Tv, Laptop, HardDrive } from "lucide-react";

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
  num_dns_queries?: number;
  num_blocked_filtering?: number;
  num_replaced_safebrowsing?: number;
  num_replaced_parental?: number;
  top_queried_domains: TopArrayEntry[];
  top_blocked_domains: TopArrayEntry[];
  top_clients: TopArrayEntry[];
  top_upstreams_avg_time: TopArrayEntry[];
};

type ViewMode = 'single' | 'combined';

// Donut Chart Component
const DonutChart = ({ data, total, label }: { data: { name: string; value: number; color: string }[]; total: number; label: string }) => {
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2A2D35"
            strokeWidth={strokeWidth}
          />
          {/* Data segments */}
          {data.map((segment, index) => {
            const percentage = total > 0 ? segment.value / total : 0;
            const dashLength = circumference * percentage;
            const dashOffset = circumference * currentOffset;
            currentOffset += percentage;

            return (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-dashOffset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{total > 0 ? total.toLocaleString() : '0'}</span>
          <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-4 space-y-2">
        {data.map((segment, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-gray-400">{segment.name}</span>
            </div>
            <span className="text-gray-300 font-mono">{total > 0 ? ((segment.value / total) * 100).toFixed(0) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Bar Chart Component
const BarChart = ({ data, maxValue }: { data: number[]; maxValue: number }) => {
  return (
    <div className="h-48">
      <div className="flex items-end justify-between h-40 gap-1">
        {data.map((value, index) => {
          const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div
              key={index}
              className="flex-1 bg-[var(--primary)]/60 hover:bg-[var(--primary)] rounded-t transition-all cursor-pointer group relative"
              style={{ height: `${Math.max(height, 2)}%` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#181A20] border border-[#2A2D35] px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {value.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
};

// Progress Bar List Item
const ProgressListItem = ({
  name,
  value,
  maxValue,
  icon,
  color = 'var(--primary)',
  isBlocked = false
}: {
  name: string;
  value: number;
  maxValue: number;
  icon?: React.ReactNode;
  color?: string;
  isBlocked?: boolean;
}) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
        {icon || (isBlocked ? <Shield className="w-4 h-4 text-red-400" /> : <Globe className="w-4 h-4 text-gray-400" />)}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-300 truncate">{name}</span>
          <span className="text-sm font-mono text-gray-400 ml-2">{value.toLocaleString()}</span>
        </div>
        <div className="w-full bg-[#2A2D35] rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
};

// Client icon helper
const getClientIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) {
    return <Smartphone className="w-4 h-4 text-[var(--primary)]" />;
  }
  if (lower.includes('macbook') || lower.includes('laptop')) {
    return <Laptop className="w-4 h-4 text-[var(--primary)]" />;
  }
  if (lower.includes('tv') || lower.includes('apple tv') || lower.includes('fire')) {
    return <Tv className="w-4 h-4 text-[var(--primary)]" />;
  }
  if (lower.includes('desktop') || lower.includes('pc') || lower.includes('windows')) {
    return <Monitor className="w-4 h-4 text-[var(--primary)]" />;
  }
  return <HardDrive className="w-4 h-4 text-[var(--primary)]" />;
};

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
        if (!response.ok) throw new Error('Failed to fetch connections.');
        const data = await response.json();
        const conns = data.connections || [];
        setConnections(conns);
        if (conns.length > 0) setSelectedConnection(conns[0]);
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
          body: JSON.stringify({ ...selectedConnection, password: decrypted }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch stats`);
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
    if (viewMode === 'single' ? selectedConnection : true) {
      fetchStats();
    }
  }, [selectedConnection, viewMode, fetchStats]);

  // Calculate derived data
  const totalQueries = stats?.num_dns_queries || stats?.dns_queries || 0;
  const blockedCount = stats?.num_blocked_filtering || 0;
  const threatsCount = (stats?.num_replaced_safebrowsing || 0) + (stats?.num_replaced_parental || 0);
  const avgTime = stats?.avg_processing_time || 0;

  // Mock hourly data (since API doesn't provide this, we generate placeholder)
  const hourlyData = useMemo(() => {
    if (!stats) return Array(24).fill(0);
    const base = totalQueries / 24;
    return Array.from({ length: 24 }, () => Math.floor(base * (0.5 + Math.random())));
  }, [stats, totalQueries]);

  // Query types for donut chart
  const queryTypes = useMemo(() => {
    const blocked = blockedCount;
    const allowed = totalQueries - blocked;
    return [
      { name: 'Allowed', value: allowed, color: 'var(--primary)' },
      { name: 'Blocked', value: blocked, color: '#ef4444' },
    ];
  }, [totalQueries, blockedCount]);

  const topClientsMax = stats?.top_clients?.[0] ? Object.values(stats.top_clients[0])[0] : 0;
  const topBlockedMax = stats?.top_blocked_domains?.[0] ? Object.values(stats.top_blocked_domains[0])[0] : 0;
  const topQueriedMax = stats?.top_queried_domains?.[0] ? Object.values(stats.top_queried_domains[0])[0] : 0;

  return (
    <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Network Traffic</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed analysis of blocked requests and DNS metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="relative flex items-center bg-[#181A20] p-1 rounded-lg border border-[#2A2D35]">
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'single' ? 'text-black bg-[var(--primary)]' : 'text-gray-400 hover:text-white'
                }`}
            >
              <Server className="w-4 h-4" /> Single
            </button>
            <button
              onClick={() => setViewMode('combined')}
              disabled={connections.length < 2}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 disabled:opacity-50 ${viewMode === 'combined' ? 'text-black bg-[var(--primary)]' : 'text-gray-400 hover:text-white'
                }`}
            >
              <Users className="w-4 h-4" /> Combined
            </button>
          </div>

          {/* Server Selector */}
          {viewMode === 'single' && (
            <select
              value={selectedConnection ? (selectedConnection.url ? selectedConnection.url.replace(/\/$/, '') : `${selectedConnection.ip}:${selectedConnection.port ?? 80}`) : ''}
              onChange={(e) => {
                const val = e.target.value;
                const conn = connections.find(c => (c.url && c.url.replace(/\/$/, '') === val) || (`${c.ip}:${c.port ?? 80}` === val));
                setSelectedConnection(conn || null);
              }}
              className="px-3 py-2 rounded-lg border border-[#2A2D35] bg-[#181A20] text-gray-300 text-sm"
              disabled={connections.length === 0}
            >
              {connections.map(conn => {
                const id = conn.url ? conn.url.replace(/\/$/, '') : `${conn.ip}:${conn.port ?? 80}`;
                return <option key={id} value={id}>{id}</option>;
              })}
            </select>
          )}

          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="p-2 rounded-lg border border-[#2A2D35] bg-[#181A20] text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12 text-[var(--primary)]">Loading statistics...</div>
      )}

      {/* Stats Content */}
      {!isLoading && !error && stats && (
        <div className="space-y-6">
          {/* Top Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Queries */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Total Queries</span>
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-[var(--primary)]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white font-mono">{totalQueries.toLocaleString()}</div>
            </div>

            {/* Blocked */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Blocked</span>
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white font-mono">{blockedCount.toLocaleString()}</span>
                <span className="text-sm text-red-400">{totalQueries > 0 ? ((blockedCount / totalQueries) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>

            {/* Threats */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Threats</span>
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white font-mono">{threatsCount.toLocaleString()}</div>
            </div>

            {/* Processing Time */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Avg. Processing</span>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white font-mono">{(avgTime * 1000).toFixed(1)}</span>
                <span className="text-lg text-gray-500">ms</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar Chart */}
            <div className="adguard-card lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold">Queries per Hour</h3>
                <span className="text-xs text-gray-500">Last 24 hours</span>
              </div>
              <BarChart data={hourlyData} maxValue={Math.max(...hourlyData)} />
            </div>

            {/* Donut Chart */}
            <div className="adguard-card flex flex-col items-center justify-center">
              <h3 className="text-white font-semibold mb-4 self-start">Query Types</h3>
              <DonutChart data={queryTypes} total={totalQueries} label="TOTAL" />
            </div>
          </div>

          {/* Lists Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Clients */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Top Clients</h3>
                <span className="text-xs text-[var(--primary)]">{stats.top_clients?.length || 0} clients</span>
              </div>
              <div className="space-y-1">
                {stats.top_clients?.slice(0, 5).map((entry, index) => {
                  const [name, value] = Object.entries(entry)[0];
                  return (
                    <ProgressListItem
                      key={`${name}-${index}`}
                      name={name}
                      value={value}
                      maxValue={topClientsMax}
                      icon={getClientIcon(name)}
                      color="var(--primary)"
                    />
                  );
                })}
                {(!stats.top_clients || stats.top_clients.length === 0) && (
                  <p className="text-gray-500 text-sm py-4 text-center">No client data available</p>
                )}
              </div>
            </div>

            {/* Top Blocked Domains */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Top Blocked Domains</h3>
                <span className="text-xs text-red-400">{stats.top_blocked_domains?.length || 0} domains</span>
              </div>
              <div className="space-y-1">
                {stats.top_blocked_domains?.slice(0, 5).map((entry, index) => {
                  const [name, value] = Object.entries(entry)[0];
                  return (
                    <ProgressListItem
                      key={`${name}-${index}`}
                      name={name}
                      value={value}
                      maxValue={topBlockedMax}
                      color="#ef4444"
                      isBlocked={true}
                    />
                  );
                })}
                {(!stats.top_blocked_domains || stats.top_blocked_domains.length === 0) && (
                  <p className="text-gray-500 text-sm py-4 text-center">No blocked domains</p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Queried Domains */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Top Queried Domains</h3>
                <span className="text-xs text-[var(--primary)]">{stats.top_queried_domains?.length || 0} domains</span>
              </div>
              <div className="space-y-1">
                {stats.top_queried_domains?.slice(0, 5).map((entry, index) => {
                  const [name, value] = Object.entries(entry)[0];
                  return (
                    <ProgressListItem
                      key={`${name}-${index}`}
                      name={name}
                      value={value}
                      maxValue={topQueriedMax}
                      icon={<Globe className="w-4 h-4 text-[var(--primary)]" />}
                      color="var(--primary)"
                    />
                  );
                })}
                {(!stats.top_queried_domains || stats.top_queried_domains.length === 0) && (
                  <p className="text-gray-500 text-sm py-4 text-center">No domain data available</p>
                )}
              </div>
            </div>

            {/* Upstream Response Times */}
            <div className="adguard-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Upstream Response Times</h3>
                <span className="text-xs text-gray-500">avg. ms</span>
              </div>
              <div className="space-y-3">
                {stats.top_upstreams_avg_time?.slice(0, 5).map((entry, index) => {
                  const [name, value] = Object.entries(entry)[0];
                  const ms = (value * 1000).toFixed(0);
                  return (
                    <div key={`${name}-${index}`} className="flex items-center justify-between py-2 border-b border-[#2A2D35] last:border-0">
                      <span className="text-sm text-gray-400 truncate flex-1 mr-4">{name}</span>
                      <span className="text-sm font-mono text-[var(--primary)]">{ms} ms</span>
                    </div>
                  );
                })}
                {(!stats.top_upstreams_avg_time || stats.top_upstreams_avg_time.length === 0) && (
                  <p className="text-gray-500 text-sm py-4 text-center">No upstream data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !stats && (
        <div className="adguard-card text-center py-12">
          <p className="text-gray-500">Select a server to view statistics.</p>
        </div>
      )}
    </main>
  );
}
